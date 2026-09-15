'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function PaceGroupTabs({
  groupsTab,
  membersTab,
  volunteersTab,
  tasksTab,
  moveLogTab,
}: {
  groupsTab: React.ReactNode;
  membersTab: React.ReactNode;
  volunteersTab: React.ReactNode;
  tasksTab: React.ReactNode;
  moveLogTab: React.ReactNode;
}) {
  return (
    <Tabs defaultValue="groups" className="space-y-6">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-surface-container p-1">
        <TabsTrigger value="groups">Pace groups</TabsTrigger>
        <TabsTrigger value="members">Members &amp; placements</TabsTrigger>
        <TabsTrigger value="volunteers">Volunteer requests</TabsTrigger>
        <TabsTrigger value="tasks">Daily tasks &amp; cursors</TabsTrigger>
        <TabsTrigger value="history">Move history</TabsTrigger>
      </TabsList>

      <TabsContent value="groups">{groupsTab}</TabsContent>
      <TabsContent value="members">{membersTab}</TabsContent>
      <TabsContent value="volunteers">{volunteersTab}</TabsContent>
      <TabsContent value="tasks">{tasksTab}</TabsContent>
      <TabsContent value="history">{moveLogTab}</TabsContent>
    </Tabs>
  );
}
