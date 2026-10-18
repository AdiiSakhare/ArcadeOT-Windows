"""Compatibility entry point; publishes the current Windows payload."""
import subprocess
import sys
from pathlib import Path
raise SystemExit(subprocess.call([sys.executable,str(Path(__file__).with_name('publish_windows.py')),*sys.argv[1:]]))
