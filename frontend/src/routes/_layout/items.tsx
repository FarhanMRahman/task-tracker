import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CalendarClock, Search, X } from "lucide-react"
import { useEffect, useState } from "react"
import { z } from "zod"

import { ItemsService, type itemsReadItemsData } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddItem from "@/components/Items/AddItem"
import { columns } from "@/components/Items/columns"
import {
  PRIORITIES,
  PRIORITY_META,
  STATUS_META,
  STATUSES,
} from "@/components/Items/itemMeta"
import PendingItems from "@/components/Pending/PendingItems"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// Filters live in the URL (?q=...&status=...), validated by zod.
// That makes filtered views shareable, bookmarkable and back-button friendly.
const SORTS = {
  "-created_at": "Newest first",
  created_at: "Oldest first",
  due_date: "Due soonest",
  "-priority": "Highest priority",
  title: "Title A–Z",
} as const
type Sort = keyof typeof SORTS

const itemsSearchSchema = z.object({
  q: z.string().optional(),
  status: z.enum(STATUSES as [string, ...string[]]).optional(),
  priority: z.enum(PRIORITIES as [string, ...string[]]).optional(),
  overdue: z.boolean().optional(),
  sort: z.enum(Object.keys(SORTS) as [Sort, ...Sort[]]).optional(),
})
type ItemsSearch = z.infer<typeof itemsSearchSchema>

const ALL = "all" // Radix Select can't use "" as a value

function getItemsQueryOptions(search: ItemsSearch) {
  const query = {
    skip: 0,
    limit: 100,
    q: search.q || undefined,
    status: search.status,
    priority: search.priority,
    overdue: search.overdue || undefined,
    sort: search.sort ?? "-created_at",
  } as itemsReadItemsData["query"]
  return {
    queryFn: async () => (await ItemsService.readItems({ query })).data,
    // The filters are part of the cache key: each filter combination is cached
    // separately, and invalidating ["items"] (after any mutation) refreshes all.
    queryKey: ["items", "list", search],
  }
}

export const Route = createFileRoute("/_layout/items")({
  component: Items,
  validateSearch: itemsSearchSchema,
  head: () => ({
    meta: [
      {
        title: "Items - FastAPI Template",
      },
    ],
  }),
})

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs)
    return () => clearTimeout(id)
  }, [value, delayMs])
  return debounced
}

function Toolbar({ search }: { search: ItemsSearch }) {
  const navigate = useNavigate({ from: Route.fullPath })
  const setSearch = (patch: Partial<ItemsSearch>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true })

  // Type freely; only hit the API 300 ms after the user stops typing.
  const [text, setText] = useState(search.q ?? "")
  const debounced = useDebouncedValue(text, 300)
  useEffect(() => {
    // Runs only when the debounced text changes. Reading the current URL via
    // `prev` (not a captured `search`) avoids acting on stale values.
    navigate({
      search: (prev) =>
        (prev.q ?? "") === debounced
          ? prev
          : { ...prev, q: debounced || undefined },
      replace: true,
    })
  }, [debounced, navigate])

  const hasFilters = Boolean(
    search.q || search.status || search.priority || search.overdue,
  )

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative w-full sm:w-64">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search title or description"
          className="pl-8"
        />
      </div>
      <Select
        value={search.status ?? ALL}
        onValueChange={(v) => setSearch({ status: v === ALL ? undefined : v })}
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_META[s].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={search.priority ?? ALL}
        onValueChange={(v) =>
          setSearch({ priority: v === ALL ? undefined : v })
        }
      >
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All priorities</SelectItem>
          {PRIORITIES.map((p) => (
            <SelectItem key={p} value={p}>
              {PRIORITY_META[p].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={search.sort ?? "-created_at"}
        onValueChange={(v) => setSearch({ sort: v as Sort })}
      >
        <SelectTrigger className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(SORTS) as Sort[]).map((s) => (
            <SelectItem key={s} value={s}>
              {SORTS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant={search.overdue ? "default" : "outline"}
        onClick={() =>
          setSearch({ overdue: search.overdue ? undefined : true })
        }
      >
        <CalendarClock className="mr-1 size-4" />
        Overdue
      </Button>
      {hasFilters && (
        <Button
          variant="ghost"
          onClick={() => {
            setText("")
            navigate({ search: { sort: search.sort }, replace: true })
          }}
        >
          <X className="mr-1 size-4" />
          Clear
        </Button>
      )}
    </div>
  )
}

function ItemsTable({ search }: { search: ItemsSearch }) {
  // keepPreviousData: while a new filter loads, keep showing the old rows
  // instead of flashing a skeleton on every keystroke.
  const { data, isPending, isFetching } = useQuery({
    ...getItemsQueryOptions(search),
    placeholderData: keepPreviousData,
  })

  if (isPending) return <PendingItems />

  if (!data || data.data.length === 0) {
    const filtered = Boolean(
      search.q || search.status || search.priority || search.overdue,
    )
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          {filtered
            ? "No items match these filters"
            : "You don't have any items yet"}
        </h3>
        <p className="text-muted-foreground">
          {filtered
            ? "Try a different search or clear the filters"
            : "Add a new item to get started"}
        </p>
      </div>
    )
  }

  return (
    <div
      className={
        isFetching ? "opacity-60 transition-opacity" : "transition-opacity"
      }
    >
      <p className="mb-2 text-sm text-muted-foreground">
        {data.count} {data.count === 1 ? "item" : "items"}
      </p>
      <DataTable columns={columns} data={data.data} />
    </div>
  )
}

function Items() {
  const search = Route.useSearch()
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Items</h1>
          <p className="text-muted-foreground">Create and manage your items</p>
        </div>
        <AddItem />
      </div>
      <Toolbar search={search} />
      <ItemsTable search={search} />
    </div>
  )
}
