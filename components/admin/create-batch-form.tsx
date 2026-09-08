"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { toast } from "sonner";

import {
  createBatchAction,
  type CreateBatchActionState,
} from "@/actions/batch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type AdminOption = {
  profileId: string;
  displayName: string;
  email: string;
  previouslyAssigned: boolean;
};

const MAX_ADMINS = 3;
const initialState: CreateBatchActionState = null;

export function CreateBatchForm({ admins }: { admins: AdminOption[] }) {
  const [state, formAction, isPending] = useActionState(
    createBatchAction,
    initialState,
  );

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [requireTelegramHandoff, setRequireTelegramHandoff] = useState(true);
  const fieldErrors = state?.errors?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.ok) toast.success("Batch created successfully");
  }, [state]);

  const isMaxReached = selectedIds.length >= MAX_ADMINS;
  const selectedAdmins = admins.filter((a) =>
    selectedIds.includes(a.profileId),
  );
  const suggested = admins.filter((a) => a.previouslyAssigned);
  const others = admins.filter((a) => !a.previouslyAssigned);

  function toggleAdmin(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_ADMINS) return prev;
      return [...prev, id];
    });
  }

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl">
              Batch details
            </CardTitle>
            <CardDescription>
              Members will see the name and description.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Batch name</Label>
              <Input
                id="name"
                name="name"
                placeholder="Batch 05 — Spring Circle"
              />
              <FieldError message={fieldErrors.name?.[0]} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                rows={3}
                placeholder="What members can expect from this batch…"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl">
              Schedule & pacing
            </CardTitle>
            <CardDescription>
              Capacity and rhythm apply to every pace group in this batch.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="maxMembers">Maximum members</Label>
                <Input
                  id="maxMembers"
                  name="maxMembers"
                  type="number"
                  min={1}
                  defaultValue={60}
                />
                <FieldError message={fieldErrors.maxMembers?.[0]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="paceGroupCount">Pace groups</Label>
                <Input
                  id="paceGroupCount"
                  name="paceGroupCount"
                  type="number"
                  min={1}
                  defaultValue={3}
                />
                <FieldError message={fieldErrors.paceGroupCount?.[0]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="startDate">Start date</Label>
                <Input id="startDate" name="startDate" type="date" />
                <FieldError message={fieldErrors.startDate?.[0]} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="readingDaysPerWeek">
                  Reading days per week
                </Label>
                <Select name="readingDaysPerWeek" defaultValue="5">
                  <SelectTrigger id="readingDaysPerWeek">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[3, 4, 5, 6, 7].map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {d} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError message={fieldErrors.readingDaysPerWeek?.[0]} />
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label htmlFor="note">Note for batch admins</Label>
              <Textarea
                id="note"
                name="note"
                rows={4}
                placeholder="Anything the pace admins should know before intake opens…"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl">Registration</CardTitle>
            <CardDescription>
              Defaults are closed registration with Telegram handoff required —
              change either below.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-surface-container p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Open registration
                </p>
                <p className="text-xs text-muted-foreground">
                  Members can apply immediately
                </p>
              </div>
              <Switch
                name="registrationOpen"
                value="true"
                checked={registrationOpen}
                onCheckedChange={setRegistrationOpen}
              />
            </div>
            <div className="flex items-center justify-between rounded-xl bg-surface-container p-4">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Require Telegram handoff
                </p>
                <p className="text-xs text-muted-foreground">After approval</p>
              </div>
              <Switch
                name="requireTelegramHandoff"
                value="true"
                checked={requireTelegramHandoff}
                onCheckedChange={setRequireTelegramHandoff}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="card-soft">
          <CardHeader>
            <CardTitle className="font-display text-xl">Batch admins</CardTitle>
            <CardDescription>
              Pick 1–3. People previously assigned show up first.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedAdmins.map((admin) => (
              <input
                key={admin.profileId}
                type="hidden"
                name="adminIds"
                value={admin.profileId}
              />
            ))}

            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={pickerOpen}
                    className="w-full justify-between font-normal"
                  >
                    {isMaxReached ?
                      "Maximum admins selected"
                    : "Search admins…"}
                    <ChevronsUpDown className="size-4 opacity-50" />
                  </Button>
                }
              />

              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Type a name or email…" />
                  <CommandList>
                    <CommandEmpty>No admins found.</CommandEmpty>
                    {suggested.length > 0 && (
                      <CommandGroup heading="Previously assigned">
                        {suggested.map((admin) => (
                          <AdminItem
                            key={admin.profileId}
                            admin={admin}
                            isSelected={selectedIds.includes(admin.profileId)}
                            disabled={
                              isMaxReached &&
                              !selectedIds.includes(admin.profileId)
                            }
                            onSelect={() => toggleAdmin(admin.profileId)}
                          />
                        ))}
                      </CommandGroup>
                    )}
                    {others.length > 0 && (
                      <CommandGroup heading="All admins">
                        {others.map((admin) => (
                          <AdminItem
                            key={admin.profileId}
                            admin={admin}
                            isSelected={selectedIds.includes(admin.profileId)}
                            disabled={
                              isMaxReached &&
                              !selectedIds.includes(admin.profileId)
                            }
                            onSelect={() => toggleAdmin(admin.profileId)}
                          />
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <div className="space-y-2">
              {selectedAdmins.length === 0 ?
                <p className="text-xs text-muted-foreground">
                  No admins assigned yet — defaults to you if left empty.
                </p>
              : <div className="flex flex-wrap gap-2">
                  {selectedAdmins.map((admin) => (
                    <Badge
                      key={admin.profileId}
                      variant="secondary"
                      className="gap-1 rounded-full py-1 pl-3 pr-1.5"
                    >
                      {admin.displayName}
                      <button
                        type="button"
                        onClick={() => toggleAdmin(admin.profileId)}
                        className="rounded-full p-0.5 hover:bg-background/60"
                        aria-label={`Remove ${admin.displayName}`}
                      >
                        <X className="size-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              }
            </div>

            <FieldError message={fieldErrors.adminIds?.[0]} />
          </CardContent>
        </Card>

        {state?.errors?.formErrors?.[0] && (
          <p className="text-xs text-destructive">
            {state.errors.formErrors[0]}
          </p>
        )}

        <div className="flex gap-3">
          <Button
            type="submit"
            className="flex-1"
            disabled={isPending}
            aria-disabled={isPending}
          >
            {isPending ? "Saving…" : "Save batch"}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/admin/batches">Cancel</Link>
          </Button>
        </div>
      </div>
    </form>
  );
}

function AdminItem({
  admin,
  isSelected,
  disabled,
  onSelect,
}: {
  admin: AdminOption;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={`${admin.displayName} ${admin.email}`}
      disabled={disabled}
      onSelect={onSelect}
      className={cn(disabled && "opacity-50")}
    >
      <Check
        className={cn("mr-2 size-4", isSelected ? "opacity-100" : "opacity-0")}
      />
      <div className="flex flex-1 flex-col">
        <span>{admin.displayName}</span>
        <span className="text-xs text-muted-foreground">{admin.email}</span>
      </div>
    </CommandItem>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;

  return <p className="text-xs text-destructive">{message}</p>;
}
