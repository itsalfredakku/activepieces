import { useMutation } from '@tanstack/react-query';
import { ColumnDef } from '@tanstack/react-table';
import {
  CheckIcon,
  EllipsisVertical,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Authorization } from '@/components/authorization';
import {
  DataTable,
  PaginationParams,
  RowDataWithActions,
} from '@/components/ui/data-table';
import { DataTableColumnHeader } from '@/components/ui/data-table-column-header';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StatusIconWithText } from '@/components/ui/status-icon-with-text';
import { INTERNAL_ERROR_TOAST, toast } from '@/components/ui/use-toast';
import { flowRunsApi } from '@/features/flow-runs/lib/flow-runs-api';
import { flowsHooks } from '@/features/flows/lib/flows-hooks';
import { authenticationSession } from '@/lib/authentication-session';
import { formatUtils } from '@/lib/utils';
import {
  FlowRetryStrategy,
  FlowRun,
  FlowRunStatus,
  Permission,
  isFailedState,
} from '@activepieces/shared';

import { flowRunUtils } from '../lib/flow-run-utils';
import { t } from 'i18next';

const fetchData = async (
  params: {
    flowId: string;
    status: FlowRunStatus[];
    created: string;
  },
  pagination: PaginationParams,
) => {
  const status = params.status;
  return flowRunsApi.list({
    status,
    projectId: authenticationSession.getProjectId(),
    flowId: params.flowId,
    cursor: pagination.cursor,
    limit: pagination.limit ?? 10,
    createdAfter: pagination.createdAfter,
    createdBefore: pagination.createdBefore,
  });
};

export default function FlowRunsTable() {
  const navigate = useNavigate();
  const [refresh, setRefresh] = useState(0);
  const { data, isFetching } = flowsHooks.useFlows();

  const flows = data?.data;

  const { mutate } = useMutation<
    void,
    Error,
    { runId: string; strategy: FlowRetryStrategy }
  >({
    mutationFn: (data) => flowRunsApi.retry(data.runId, data),
    onSuccess: () => {
      // TODO This should auto refresh the table when there is run with success tatus
      setRefresh(refresh + 1);
    },
    onError: () => {
      toast(INTERNAL_ERROR_TOAST);
    },
  });

  const columns: ColumnDef<RowDataWithActions<FlowRun>>[] = useMemo(
    () => [
      {
        accessorKey: 'flowId',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Flow')} />
        ),
        cell: ({ row }) => {
          return (
            <div className="text-left">{row.original.flowDisplayName}</div>
          );
        },
      },
      {
        accessorKey: 'status',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Status')} />
        ),
        cell: ({ row }) => {
          const status = row.original.status;
          const { variant, Icon } = flowRunUtils.getStatusIcon(status);
          return (
            <div className="text-left">
              <StatusIconWithText
                icon={Icon}
                text={formatUtils.convertEnumToHumanReadable(status)}
                variant={variant}
              />
            </div>
          );
        },
      },
      {
        accessorKey: 'created',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Start Time')} />
        ),
        cell: ({ row }) => {
          return (
            <div className="text-left">
              {formatUtils.formatDate(new Date(row.original.startTime))}
            </div>
          );
        },
      },
      {
        accessorKey: 'duration',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Duration')} />
        ),
        cell: ({ row }) => {
          return (
            <div className="text-left">
              {formatUtils.formatDuration(row.original.duration)}
            </div>
          );
        },
      },
      {
        accessorKey: 'actions',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title={t('Actions')} />
        ),
        cell: ({ row }) => {
          return (
            <Authorization permission={Permission.RETRY_RUN}>
              <div
                className="flex items-end justify-end"
                onClick={(e) => e.stopPropagation()}
              >
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger
                    asChild
                    className="rounded-full p-2 hover:bg-muted cursor-pointer"
                  >
                    <EllipsisVertical className="h-10 w-10" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      onClick={() =>
                        mutate({
                          runId: row.original.id,
                          strategy: FlowRetryStrategy.ON_LATEST_VERSION,
                        })
                      }
                    >
                      <div className="flex flex-row gap-2 items-center">
                        <RefreshCw className="h-4 w-4" />
                        <span>{t('Retry on latest version')}</span>
                      </div>
                    </DropdownMenuItem>
                    {isFailedState(row.original.status) && (
                      <DropdownMenuItem
                        onClick={() =>
                          mutate({
                            runId: row.original.id,
                            strategy: FlowRetryStrategy.FROM_FAILED_STEP,
                          })
                        }
                      >
                        <div className="flex flex-row gap-2 items-center">
                          <RotateCcw className="h-4 w-4" />
                          <span>{t('Retry from failed step')}</span>
                        </div>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </Authorization>
          );
        },
      },
    ],
    [],
  );

  const filters = useMemo(
    () => [
      {
        type: 'select',
        title: t('Flow name'),
        accessorKey: 'flowId',
        options:
          flows?.map((flow) => ({
            label: flow.version.displayName,
            value: flow.id,
          })) || [],
        icon: CheckIcon,
      } as const,
      {
        type: 'select',
        title: t('Status'),
        accessorKey: 'status',
        options: Object.values(FlowRunStatus)
          .filter((status) => status !== FlowRunStatus.STOPPED)
          .map((status) => {
            return {
              label: formatUtils.convertEnumToHumanReadable(status),
              value: status,
              icon: flowRunUtils.getStatusIcon(status).Icon,
            };
          }),
        icon: CheckIcon,
      } as const,
      {
        type: 'date',
        title: t('Created'),
        accessorKey: 'created',
        options: [],
        icon: CheckIcon,
      } as const,
    ],
    [flows],
  );

  useEffect(() => {
    if (!isFetching) {
      setRefresh((prev) => prev + 1);
    }
  }, [isFetching]);

  return (
    <div className="flex-col w-full">
      <div className="mb-4 flex">
        <h1 className="text-3xl font-bold">{t('Flow Runs')}</h1>
        <div className="ml-auto"></div>
      </div>
      <DataTable
        columns={columns}
        fetchData={fetchData}
        filters={filters}
        refresh={refresh}
        onRowClick={(row) => navigate(`/runs/${row.id}`)}
      />
    </div>
  );
}