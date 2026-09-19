'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PaceGroupTabs({
  groupsTab,
  membersTab,
  volunteersTab,
  tasksTab,
}: {
  groupsTab: React.ReactNode;
  membersTab: React.ReactNode;
  volunteersTab: React.ReactNode;
  tasksTab: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="groups" className="space-y-6">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-2 bg-surface-container p-2">
        <TabsTrigger value="groups">Pace groups</TabsTrigger>
        <TabsTrigger value="members">Members &amp; placements</TabsTrigger>
        <TabsTrigger value="volunteers">Volunteer requests</TabsTrigger>
        <TabsTrigger value="tasks">Daily tasks &amp; cursors</TabsTrigger>
      </TabsList>

      <TabsContent value="groups">{groupsTab}</TabsContent>
      <TabsContent value="members">{membersTab}</TabsContent>
      <TabsContent value="volunteers">{volunteersTab}</TabsContent>
      <TabsContent value="tasks">{tasksTab}</TabsContent>
    </Tabs>
  );
}
