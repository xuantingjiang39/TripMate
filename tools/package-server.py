"""Build reviewed server ZIPs with Linux shell bytes independent of Windows checkout settings."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

ROOT = Path(__file__).resolve().parent.parent
ALLOWED = {'.mjs', '.js', '.sh', '.html', '.png', '.md', '.txt'}
REQUIRED = {'update-tripmate.sh', 'install.sh', 'tripmate-ai-server.mjs', 'tripmate-mvp.html',
            'tripmate-downloads.mjs', 'tripmate-download.html', 'install-downloads.sh'}

def linux_script(raw):
    data = raw.removeprefix(b'\xef\xbb\xbf').replace(b'\r\n', b'\n')
    if b'\r' in data or not data.startswith(b'#!/usr/bin/env bash\n'):
        raise ValueError('Shell script has invalid encoding, shebang or line endings')
    return data

def verify_archive(filename):
    with zipfile.ZipFile(filename) as archive:
        names = set(archive.namelist())
        if not REQUIRED <= names:
            raise ValueError('Missing server files')
        if archive.testzip() is not None:
            raise ValueError('ZIP CRC check failed')
        for name in names:
            p = Path(name)
            if p.is_absolute() or '..' in p.parts or any(part.lower() in {'node_modules','data','.env','accounts.json','users.json','config.json'} for part in p.parts):
                raise ValueError('Unsafe archive entry: ' + name)
            if name.endswith('.sh'):
                raw = archive.read(name)
                if raw != linux_script(raw):
                    raise ValueError('Non-LF/BOM shell script inside ZIP: ' + name)
    return len(names)

def build(source, destination, full=False):
    source = source.resolve()
    if not source.is_relative_to(ROOT) or not source.is_dir():
        raise ValueError('Source must be a component directory inside this workspace')
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for file in sorted(source.iterdir()):
            if not file.is_file() or file.is_symlink() or file.suffix not in ALLOWED or file.name.startswith('.'):
                continue
            raw = file.read_bytes()
            if file.suffix == '.sh':
                raw = linux_script(raw)
            info = zipfile.ZipInfo(file.name)
            info.create_system = 3
            info.external_attr = (0o100755 if file.suffix == '.sh' else 0o100644) << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, raw)
        if full:
            for line in (source / 'downloads-SHA256SUMS.txt').read_text(encoding='utf-8-sig').splitlines():
                digest, name = line.split()
                file = source / name
                if not file.resolve().is_relative_to(source / 'downloads') or file.is_symlink():
                    raise ValueError('Invalid installer path')
                with file.open('rb') as stream:
                    if hashlib.file_digest(stream, 'sha256').hexdigest() != digest:
                        raise ValueError('Installer checksum mismatch: ' + name)
                archive.write(file, name)
    return verify_archive(destination)

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify', type=Path)
    args = parser.parse_args()
    if args.verify:
        print('PASS archive entries:', verify_archive(args.verify))
    else:
        project = json.loads((ROOT/'PROJECT.json').read_text(encoding='utf-8-sig'))
        component = project['components']['server']
        source = ROOT/component['source']
        for key, full in [('updateArchive', False), ('installer', True)]:
            filename = ROOT/component[key]
            print(filename.name, 'entries:', build(source, filename, full))
        checksums = []
        for key in ['updateArchive', 'installer']:
            file = ROOT/component[key]
            with file.open('rb') as stream:
                digest = hashlib.file_digest(stream, 'sha256').hexdigest()
            checksums.append(digest+'  '+file.name)
        (ROOT/f"TripMate-v{component['release']}-SHA256SUMS.txt").write_bytes(('\n'.join(checksums)+'\n').encode('utf-8'))
