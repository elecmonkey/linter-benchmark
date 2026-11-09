"""Read process-tree RSS through libproc without spawning ps per sample."""
import ctypes
import json
import os
import sys


class BsdInfo(ctypes.Structure):
    _fields_ = [(name, ctypes.c_uint32) for name in (
        'flags', 'status', 'xstatus', 'pid', 'ppid', 'uid', 'gid',
        'ruid', 'rgid', 'svuid', 'svgid', 'reserved',
    )] + [('comm', ctypes.c_char * 16), ('name', ctypes.c_char * 32)] + [
        (name, ctypes.c_uint32) for name in ('nfiles', 'pgid', 'jobc', 'tdev', 'tpgid')
    ] + [('nice', ctypes.c_int32), ('start_sec', ctypes.c_uint64), ('start_usec', ctypes.c_uint64)]


class TaskInfo(ctypes.Structure):
    _fields_ = [(name, ctypes.c_uint64) for name in (
        'virtual', 'resident', 'total_user', 'total_system', 'threads_user', 'threads_system',
    )] + [(name, ctypes.c_int32) for name in (
        'policy', 'faults', 'pageins', 'cow_faults', 'messages_sent', 'messages_received',
        'syscalls_mach', 'syscalls_unix', 'context_switches', 'threads', 'running', 'priority',
    )]


class TaskAllInfo(ctypes.Structure):
    _fields_ = [('bsd', BsdInfo), ('task', TaskInfo)]


lib = ctypes.CDLL('/usr/lib/libproc.dylib', use_errno=True)
lib.proc_listpids.argtypes = [ctypes.c_uint32, ctypes.c_uint32, ctypes.c_void_p, ctypes.c_int]
lib.proc_listpids.restype = ctypes.c_int
lib.proc_pidinfo.argtypes = [ctypes.c_int, ctypes.c_int, ctypes.c_uint64, ctypes.c_void_p, ctypes.c_int]
lib.proc_pidinfo.restype = ctypes.c_int


def info_for(pid):
    info = TaskAllInfo()
    size = ctypes.sizeof(info)
    return info if lib.proc_pidinfo(pid, 2, 0, ctypes.byref(info), size) == size else None


def tree_rss_kb(root_pid):
    size = lib.proc_listpids(1, 0, None, 0)
    if size <= 0:
        raise RuntimeError('proc_listpids failed')
    pids = (ctypes.c_int * (size // ctypes.sizeof(ctypes.c_int) + 256))()
    size = lib.proc_listpids(1, 0, pids, ctypes.sizeof(pids))
    if size <= 0:
        raise RuntimeError('proc_listpids failed')
    children, rss = {}, {}
    for pid in pids[:size // ctypes.sizeof(ctypes.c_int)]:
        info = info_for(pid)
        if info is not None:
            children.setdefault(info.bsd.ppid, []).append(pid)
            rss[pid] = info.task.resident
    total, stack = 0, [root_pid]
    while stack:
        pid = stack.pop()
        total += rss.get(pid, 0)
        stack.extend(children.get(pid, []))
    return total / 1024


self_info = info_for(os.getpid())
if self_info is None or self_info.bsd.ppid != os.getppid() or not self_info.task.resident:
    raise RuntimeError('libproc process layout check failed')
print(json.dumps({'ready': True}), flush=True)
for line in sys.stdin:
    request = json.loads(line)
    try:
        response = {'id': request['id'], 'kb': tree_rss_kb(request['pid'])}
    except Exception as error:
        response = {'id': request['id'], 'error': str(error)}
    print(json.dumps(response), flush=True)
