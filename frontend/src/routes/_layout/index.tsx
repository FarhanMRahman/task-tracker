import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ListTodo,
} from "lucide-react"
import type { ReactNode } from "react"

import { ItemsService, type ItemsStats } from "@/client"
import {
  PRIORITIES,
  PRIORITY_META,
  STATUS_META,
  STATUSES,
} from "@/components/Items/itemMeta"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import useAuth from "@/hooks/useAuth"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/")({
  component: Dashboard,
  head: () => ({
    meta: [
      {
        title: "Dashboard - FastAPI Template",
      },
    ],
  }),
})

// Same "items" prefix as the list, so every item mutation
// (which invalidates ["items"]) refreshes the dashboard too.
const statsQuery = {
  queryKey: ["items", "stats"],
  queryFn: async () => (await ItemsService.readItemsStats()).data,
}

function StatCard({
  title,
  value,
  hint,
  icon,
  to,
  tone,
}: {
  title: string
  value: ReactNode
  hint: string
  icon: ReactNode
  to?: { search: Record<string, unknown> }
  tone?: "warn"
}) {
  const body = (
    <Card className={cn("h-full transition-colors", to && "hover:bg-muted/50")}>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <span
          className={cn(
            "text-muted-foreground",
            tone === "warn" && "text-rose-500",
          )}
        >
          {icon}
        </span>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-3xl font-bold",
            tone === "warn" && "text-rose-600 dark:text-rose-400",
          )}
        >
          {value}
        </div>
        <p className="text-xs text-muted-foreground mt-1">{hint}</p>
      </CardContent>
    </Card>
  )
  return to ? (
    <Link to="/items" search={to.search}>
      {body}
    </Link>
  ) : (
    body
  )
}

function Breakdown({
  title,
  rows,
  meta,
  order,
  filterKey,
}: {
  title: string
  rows: ItemsStats["by_status"]
  meta: Record<string, { label: string; className: string }>
  order: string[]
  filterKey: "status" | "priority"
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0)
  const counts = Object.fromEntries(rows.map((r) => [r.key, r.count]))
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* One stacked bar for the whole, then a row per part */}
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
          {order.map((key) => (
            <div
              key={key}
              className={cn(meta[key].className, "h-full")}
              style={{
                width: total ? `${((counts[key] ?? 0) / total) * 100}%` : 0,
              }}
            />
          ))}
        </div>
        {order.map((key) => (
          <Link
            key={key}
            to="/items"
            search={{ [filterKey]: key }}
            className="flex items-center justify-between rounded-md px-2 py-1 text-sm hover:bg-muted/50"
          >
            <span className="flex items-center gap-2">
              <span
                className={cn("size-2.5 rounded-full", meta[key].className)}
              />
              {meta[key].label}
            </span>
            <span className="tabular-nums text-muted-foreground">
              {counts[key] ?? 0}
              {total > 0 &&
                ` · ${Math.round(((counts[key] ?? 0) / total) * 100)}%`}
            </span>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}

function ActivityChart({ days }: { days: ItemsStats["created_per_day"] }) {
  const max = Math.max(1, ...days.map((d) => d.count))
  const total = days.reduce((sum, d) => sum + d.count, 0)
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Items created, last 14 days</CardTitle>
        <p className="text-sm text-muted-foreground">{total} in total</p>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-1.5">
          {days.map((d) => {
            const label = new Date(`${d.day}T00:00:00`).toLocaleDateString(
              undefined,
              {
                month: "short",
                day: "numeric",
              },
            )
            return (
              <div
                key={d.day}
                className="group flex h-full flex-1 flex-col justify-end items-center gap-1"
              >
                <span className="text-[10px] tabular-nums text-muted-foreground opacity-0 group-hover:opacity-100">
                  {d.count}
                </span>
                <div
                  title={`${label}: ${d.count}`}
                  className="w-full rounded-t bg-primary/80 group-hover:bg-primary transition-colors"
                  style={{
                    height: `${(d.count / max) * 100}%`,
                    minHeight: d.count ? 4 : 1,
                  }}
                />
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>
            {new Date(`${days[0]?.day}T00:00:00`).toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" },
            )}
          </span>
          <span>Today</span>
        </div>
      </CardContent>
    </Card>
  )
}

function Dashboard() {
  const { user: currentUser } = useAuth()
  const { data: stats, isPending } = useQuery(statsQuery)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl truncate max-w-sm">
          Hi, {currentUser?.full_name || currentUser?.email} 👋
        </h1>
        <p className="text-muted-foreground">
          {currentUser?.is_superuser
            ? "Here's what's happening across all items."
            : "Here's where your items stand."}
        </p>
      </div>

      {isPending || !stats ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total items"
              value={stats.total}
              hint="All statuses"
              icon={<ListTodo className="size-4" />}
              to={{ search: {} }}
            />
            <StatCard
              title="Completion"
              value={`${Math.round(stats.completion_rate * 100)}%`}
              hint="Share of items marked done"
              icon={<CheckCircle2 className="size-4" />}
              to={{ search: { status: "done" } }}
            />
            <StatCard
              title="Overdue"
              value={stats.overdue}
              hint="Past due and not done"
              icon={<CalendarClock className="size-4" />}
              to={{ search: { overdue: true, sort: "due_date" } }}
              tone={stats.overdue > 0 ? "warn" : undefined}
            />
            <StatCard
              title="Due this week"
              value={stats.due_this_week}
              hint="Next 7 days, not done"
              icon={<CalendarDays className="size-4" />}
              to={{ search: { sort: "due_date" } }}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <ActivityChart days={stats.created_per_day} />
            </div>
            <div className="grid gap-4">
              <Breakdown
                title="By status"
                rows={stats.by_status}
                meta={STATUS_META}
                order={STATUSES}
                filterKey="status"
              />
              <Breakdown
                title="By priority"
                rows={stats.by_priority}
                meta={PRIORITY_META}
                order={PRIORITIES}
                filterKey="priority"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
