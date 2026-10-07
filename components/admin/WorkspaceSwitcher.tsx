// components/admin/WorkspaceSwitcher.tsx
'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Layers,
  LayoutDashboard,
  type LucideIcon,
} from 'lucide-react';

import {
  Fragment,
  useCallback,
  useMemo,
  useState,
  useTransition,
  type ReactNode,
} from 'react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useSidebar } from '@/components/ui/sidebar';
import type { AdminWorkspaceOption } from '@/lib/services/admin/workspace';

const LIST_LIMIT = 8;

const MOBILE_SEARCH_THRESHOLD = 8;

const GROUPS: {
  kind: 'platform' | 'batch';
  title: string;
  icon: LucideIcon;
}[] = [
  { kind: 'platform', title: 'Platform', icon: LayoutDashboard },
  { kind: 'batch', title: 'Batches', icon: Layers },
];

/** The option whose href is the longest prefix of the current path. */
function findCurrentHref(
  options: AdminWorkspaceOption[],
  pathname: string,
): string | null {
  let best: string | null = null;
  for (const option of options) {
    if (option.kind === 'platform') {
      const matches =
        pathname === option.href || pathname.startsWith(`${option.href}/`);
      if (matches && (best === null || option.href.length > best.length)) {
        best = option.href;
      }
      continue;
    }

    const batchHref = option.href;
    if (batchHref) {
      const matches =
        pathname === batchHref || pathname.startsWith(`${batchHref}/`);
      if (matches && (best === null || batchHref.length > best.length)) {
        best = batchHref;
      }
    }

    for (const group of option.groups) {
      const matches =
        pathname === group.href || pathname.startsWith(`${group.href}/`);
      if (matches && (best === null || group.href.length > best.length)) {
        best = group.href;
      }
    }
  }
  return best;
}

interface WorkspaceCommandProps {
  options: AdminWorkspaceOption[];
  currentHref: string | null;
  showSearch: boolean;
  touch: boolean;
  onSelect: (href: string) => void;
}

/**
 * The list itself. It is only mounted while the dialog/drawer is open, so
 * its search and "show all" state resets automatically on close.
 */
function WorkspaceCommand({
  options,
  currentHref,
  showSearch,
  touch,
  onSelect,
}: WorkspaceCommandProps) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Set<string>>(
    new Set(),
  );
  const [showAllGroups, setShowAllGroups] = useState<Set<string>>(new Set());

  const { visible, hiddenCount } = useMemo(() => {
    const q = query.trim().toLocaleLowerCase();
    const matches = options.flatMap<AdminWorkspaceOption>((option) => {
      if (option.kind === 'platform') {
        return !q || option.title.toLocaleLowerCase().includes(q)
          ? [option]
          : [];
      }

      const batchMatches = option.title.toLocaleLowerCase().includes(q);
      const matchingGroups = option.groups.filter(
        (group) =>
          (!q && !group.searchOnly) ||
          (q && (batchMatches || group.title.toLocaleLowerCase().includes(q))),
      );
      if (
        (!q && option.searchOnly) ||
        (!q && !option.href && matchingGroups.length === 0) ||
        (q && !batchMatches && !matchingGroups.length)
      ) {
        return [];
      }

      return [{ ...option, groups: matchingGroups }];
    });
    const platforms = matches.filter((option) => option.kind === 'platform');
    const batches = matches.filter((option) => option.kind === 'batch');
    const shownBatches = showAll ? batches : batches.slice(0, LIST_LIMIT);
    return {
      visible: [...platforms, ...shownBatches],
      hiddenCount: batches.length - shownBatches.length,
    };
  }, [options, query, showAll]);

  const rowClass = touch ? 'min-h-12 py-3 text-base' : undefined;
  const toggleBatch = (batchId: string) => {
    setExpandedBatches((current) => {
      const next = new Set(current);
      if (next.has(batchId)) next.delete(batchId);
      else next.add(batchId);
      return next;
    });
  };

  return (
    <Command shouldFilter={false} className="rounded-xl p-2">
      {showSearch ? (
        <CommandInput
          placeholder="Search workspaces..."
          value={query}
          onValueChange={(value) => {
            setQuery(value);
            setShowAll(false);
          }}
        />
      ) : null}
      <CommandList className={touch ? 'max-h-[60vh]' : undefined}>
        {visible.length === 0 ? (
          <CommandEmpty>No assigned workspaces found.</CommandEmpty>
        ) : (
          GROUPS.map(({ kind, title, icon: Icon }) => {
            const items = visible.filter((option) => option.kind === kind);
            if (items.length === 0) return null;

            return (
              <CommandGroup key={kind} heading={title}>
                {items.map((option) => (
                  <Fragment
                    key={
                      option.kind === 'platform'
                        ? option.href
                        : `batch-${option.id}`
                    }
                  >
                    <CommandItem
                      value={
                        option.kind === 'platform'
                          ? option.href
                          : `batch-${option.id}`
                      }
                      onSelect={() => {
                        if (option.kind === 'platform') onSelect(option.href);
                        else if (option.href) onSelect(option.href);
                      }}
                      className={rowClass}
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{option.title}</span>
                        {option.kind === 'batch' && !option.href ? (
                          <span className="truncate text-xs text-muted-foreground">
                            Pace group assignment
                          </span>
                        ) : null}
                      </span>
                      {option.kind === 'platform' &&
                      option.href === currentHref ? (
                        <Check
                          className="size-4 shrink-0 text-muted-foreground"
                          aria-label="Current workspace"
                        />
                      ) : null}
                      {option.kind === 'batch' ? (
                        <>
                          {option.href === currentHref ? (
                            <Check
                              className="size-4 shrink-0 text-muted-foreground"
                              aria-label="Current workspace"
                            />
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`${expandedBatches.has(option.id) ? 'Hide' : 'Show'} pace groups in ${option.title}`}
                            aria-expanded={expandedBatches.has(option.id)}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleBatch(option.id);
                            }}
                          >
                            <ChevronRight
                              className="size-4 transition-transform data-[expanded=true]:rotate-90"
                              data-expanded={expandedBatches.has(option.id)}
                            />
                          </Button>
                        </>
                      ) : null}
                    </CommandItem>
                    {option.kind === 'batch' &&
                    (expandedBatches.has(option.id) ||
                      (query.trim() &&
                        option.groups.some((group) =>
                          group.title
                            .toLocaleLowerCase()
                            .includes(query.trim().toLocaleLowerCase()),
                        ))) &&
                    option.groups.length > 0 ? (
                      <CommandGroup
                        heading={`Pace groups in ${option.title}`}
                        className="ml-6 border-l border-border pl-2"
                      >
                        {(showAllGroups.has(option.id)
                          ? option.groups
                          : option.groups.slice(0, LIST_LIMIT)
                        ).map((group) => (
                          <CommandItem
                            key={group.href}
                            value={`group-${group.id}`}
                            onSelect={() => onSelect(group.href)}
                            className={rowClass}
                          >
                            <span className="truncate">{group.title}</span>
                            {group.href === currentHref ? (
                              <Check
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-label="Current workspace"
                              />
                            ) : null}
                          </CommandItem>
                        ))}
                        {option.groups.length > LIST_LIMIT &&
                        !showAllGroups.has(option.id) ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size={touch ? 'default' : 'sm'}
                            className="w-full"
                            onClick={() =>
                              setShowAllGroups((current) =>
                                new Set(current).add(option.id),
                              )
                            }
                          >
                            Show all {option.groups.length} groups
                          </Button>
                        ) : null}
                      </CommandGroup>
                    ) : null}
                  </Fragment>
                ))}
              </CommandGroup>
            );
          })
        )}
      </CommandList>

      {hiddenCount > 0 ? (
        <div className="border-t border-border p-2">
          <Button
            type="button"
            variant="ghost"
            size={touch ? 'default' : 'sm'}
            className="w-full"
            onClick={() => setShowAll(true)}
          >
            Show all{' '}
            {visible.filter((option) => option.kind === 'batch').length +
              hiddenCount}{' '}
            batches
          </Button>
        </div>
      ) : null}
    </Command>
  );
}

interface WorkspaceSwitcherProps {
  options: AdminWorkspaceOption[];
  currentTitle: string;
  children: ReactNode;
}

export function WorkspaceSwitcher({
  options,
  currentTitle,
  children,
}: WorkspaceSwitcherProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const hasNestedWorkspaces = options.some(
    (option) => option.kind === 'batch' && option.groups.length > 0,
  );
  const canSwitch = options.length > 1 || hasNestedWorkspaces;
  const currentHref = useMemo(
    () => findCurrentHref(options, pathname),
    [options, pathname],
  );
  const workspaceCount = options.reduce(
    (total, option) =>
      total + 1 + (option.kind === 'batch' ? option.groups.length : 0),
    0,
  );
  const showSearch = !isMobile || workspaceCount > MOBILE_SEARCH_THRESHOLD;

  const handleSelect = useCallback(
    (href: string) => {
      setOpen(false);
      setOpenMobile(false);
      if (href === currentHref) return;
      startTransition(() => router.push(href));
    },
    [currentHref, router, setOpenMobile],
  );

  if (!canSwitch) return <>{children}</>;

  const list = (
    <WorkspaceCommand
      options={options}
      currentHref={currentHref}
      showSearch={showSearch}
      touch={isMobile}
      onSelect={handleSelect}
    />
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        aria-label={`Switch workspace. Current: ${currentTitle}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="flex h-auto w-full justify-start gap-2 rounded-lg p-2 text-left hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
        <ChevronDown className="size-4 shrink-0 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" />
      </Button>
      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent initialFocus={false}>
            <DrawerHeader className="sr-only">
              <DrawerTitle>Switch workspace</DrawerTitle>
              <DrawerDescription>
                Choose a workspace you are assigned to.
              </DrawerDescription>
            </DrawerHeader>
            {list}
          </DrawerContent>
        </Drawer>
      ) : (
        <CommandDialog
          open={open}
          onOpenChange={setOpen}
          title="Switch workspace"
          description="Search your assigned workspaces."
          className="sm:max-w-lg"
        >
          {list}
        </CommandDialog>
      )}
    </>
  );
}
