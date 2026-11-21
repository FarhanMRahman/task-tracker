import { CalendarClock } from "lucide-react"
import type { Control, FieldValues, Path } from "react-hook-form"
import { z } from "zod"

import type { ItemPriority, ItemStatus } from "@/client"
import { Badge } from "@/components/ui/badge"
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// One place for labels and colours, so the table, filters, forms and
// dashboard always agree. The keys come from the generated client types,
// so a renamed backend enum value becomes a TypeScript error here.
export const STATUS_META: Record<
  ItemStatus,
  { label: string; className: string }
> = {
  todo: {
    label: "To do",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  },
  in_progress: {
    label: "In progress",
    className: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  },
  done: {
    label: "Done",
    className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  },
}

export const PRIORITY_META: Record<
  ItemPriority,
  { label: string; className: string }
> = {
  low: {
    label: "Low",
    className: "bg-slate-500/15 text-slate-700 dark:text-slate-300",
  },
  medium: {
    label: "Medium",
    className: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  high: {
    label: "High",
    className: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  },
}

export const STATUSES = Object.keys(STATUS_META) as ItemStatus[]
export const PRIORITIES = Object.keys(PRIORITY_META) as ItemPriority[]

// Form schema shared by Add and Edit. Dates travel as "YYYY-MM-DD" strings;
// an empty date input means "no due date" and is sent as null.
export const itemFormSchema = z.object({
  title: z.string().min(1, { message: "Title is required" }).max(255),
  description: z.string().max(255).optional(),
  status: z.enum(STATUSES as [ItemStatus, ...ItemStatus[]]),
  priority: z.enum(PRIORITIES as [ItemPriority, ...ItemPriority[]]),
  due_date: z.string().optional(),
})
export type ItemFormData = z.infer<typeof itemFormSchema>

export function toItemPayload(data: ItemFormData) {
  return { ...data, due_date: data.due_date ? data.due_date : null }
}

export function StatusBadge({ status }: { status: ItemStatus }) {
  const meta = STATUS_META[status]
  return (
    <Badge className={cn("border-transparent", meta.className)}>
      {meta.label}
    </Badge>
  )
}

export function PriorityBadge({ priority }: { priority: ItemPriority }) {
  const meta = PRIORITY_META[priority]
  return (
    <Badge className={cn("border-transparent", meta.className)}>
      {meta.label}
    </Badge>
  )
}

export function isOverdue(
  dueDate: string | null | undefined,
  status: ItemStatus,
) {
  if (!dueDate || status === "done") return false
  return dueDate < new Date().toISOString().slice(0, 10) // ISO dates compare as strings
}

export function DueDate({
  dueDate,
  status,
}: {
  dueDate?: string | null
  status: ItemStatus
}) {
  if (!dueDate) return <span className="text-muted-foreground">—</span>
  const late = isOverdue(dueDate, status)
  const label = new Date(`${dueDate}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap",
        late && "font-medium text-rose-600 dark:text-rose-400",
      )}
    >
      {late && <CalendarClock className="size-3.5" />}
      {label}
    </span>
  )
}

// Status, priority and due date fields, reused by AddItem and EditItem.
export function ItemExtraFields<T extends FieldValues>({
  control,
}: {
  control: Control<T>
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <FormField
        control={control}
        name={"status" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Status</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"priority" as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>Priority</FormLabel>
            <Select onValueChange={field.onChange} value={field.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITY_META[p].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={"due_date" as Path<T>}
        render={({ field }) => (
          <FormItem className="col-span-2">
            <FormLabel>Due date</FormLabel>
            <FormControl>
              <Input type="date" {...field} value={field.value ?? ""} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
