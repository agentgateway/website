### Cgroup memory

These metrics track Linux cgroup v2 memory statistics for the agentgateway process. They are available whenever agentgateway runs in a Linux environment, including standalone deployments, and are not specific to Kubernetes mode.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_cgroup_usage` | Gauge | bytes | Current memory usage. |
| `agentgateway_cgroup_working_set` | Gauge | bytes | Current working set. |
| `agentgateway_cgroup_anon` | Gauge | bytes | Current anonymous memory usage. |
| `agentgateway_cgroup_active_anon` | Gauge | bytes | Current active anonymous memory usage. |
| `agentgateway_cgroup_inactive_anon` | Gauge | bytes | Current inactive anonymous memory usage. |
| `agentgateway_cgroup_file` | Gauge | bytes | Current file memory usage. |
| `agentgateway_cgroup_file_mapped` | Gauge | bytes | Current mapped file memory usage. |
| `agentgateway_cgroup_active_file` | Gauge | bytes | Current active file memory usage. |
| `agentgateway_cgroup_inactive_file` | Gauge | bytes | Current inactive file memory usage. |
| `agentgateway_cgroup_shmem` | Gauge | bytes | Current shared memory usage. |
| `agentgateway_cgroup_kernel` | Gauge | bytes | Current kernel memory usage. |
| `agentgateway_cgroup_kernel_stack` | Gauge | bytes | Current kernel stack memory usage. |
| `agentgateway_cgroup_pagetables` | Gauge | bytes | Current page tables memory usage. |
| `agentgateway_cgroup_percpu` | Gauge | bytes | Current per-CPU memory usage. |
| `agentgateway_cgroup_sock` | Gauge | bytes | Current socket memory usage. |
| `agentgateway_cgroup_slab` | Gauge | bytes | Current slab memory usage. |
| `agentgateway_cgroup_slab_reclaimable` | Gauge | bytes | Current reclaimable slab memory usage. |
| `agentgateway_cgroup_slab_unreclaimable` | Gauge | bytes | Current unreclaimable slab memory usage. |
| `agentgateway_cgroup_pgfault_total` | Counter | — | Total cgroup page faults. |
| `agentgateway_cgroup_pgmajfault_total` | Counter | — | Total cgroup major page faults. |
| `agentgateway_cgroup_workingset_refault_anon_total` | Counter | — | Total anonymous working set refaults. |
| `agentgateway_cgroup_workingset_refault_file_total` | Counter | — | Total file working set refaults. |
| `agentgateway_cgroup_workingset_activate_anon_total` | Counter | — | Total anonymous working set activations. |
| `agentgateway_cgroup_workingset_activate_file_total` | Counter | — | Total file working set activations. |
| `agentgateway_cgroup_workingset_restore_anon_total` | Counter | — | Total anonymous working set restores. |
| `agentgateway_cgroup_workingset_restore_file_total` | Counter | — | Total file working set restores. |

### Process memory

These metrics track process-level memory for the agentgateway process, sourced from `/proc/self/smaps`. They are available whenever agentgateway runs in a Linux environment, including standalone deployments, and are not specific to Kubernetes mode.

| Metric | Type | Unit | Description |
| --- | --- | --- | --- |
| `agentgateway_process_size` | Gauge | bytes | Total virtual memory size of the process. |
| `agentgateway_process_rss` | Gauge | bytes | RSS (resident set size) memory usage. |
| `agentgateway_process_pss` | Gauge | bytes | PSS (proportional set size) memory usage. |
| `agentgateway_process_pss_dirty` | Gauge | bytes | Dirty PSS memory usage. |
| `agentgateway_process_shared_clean` | Gauge | bytes | Shared clean memory usage. |
| `agentgateway_process_shared_dirty` | Gauge | bytes | Shared dirty memory usage. |
| `agentgateway_process_private_clean` | Gauge | bytes | Private clean memory usage. |
| `agentgateway_process_private_dirty` | Gauge | bytes | Private dirty memory usage. |
| `agentgateway_process_referenced` | Gauge | bytes | Referenced memory usage. |
| `agentgateway_process_anonymous` | Gauge | bytes | Anonymous memory usage. |
| `agentgateway_process_lazy_free` | Gauge | bytes | Lazy free memory. |
| `agentgateway_process_anon_huge_pages` | Gauge | bytes | Anonymous huge pages usage. |
| `agentgateway_process_shmem_huge_pages` | Gauge | bytes | Shared memory huge pages usage. |
| `agentgateway_process_shmem_pmd_mapped` | Gauge | bytes | Shared memory PMD-mapped usage. |
| `agentgateway_process_file_pmd_mapped` | Gauge | bytes | File PMD-mapped usage. |
| `agentgateway_process_shared_hugetlb` | Gauge | bytes | Shared hugetlb usage. |
| `agentgateway_process_private_hugetlb` | Gauge | bytes | Private hugetlb usage. |
| `agentgateway_process_swap` | Gauge | bytes | Process swap usage. |
| `agentgateway_process_swap_pss` | Gauge | bytes | Process proportional swap usage. |
| `agentgateway_process_locked` | Gauge | bytes | Process locked memory usage. |

