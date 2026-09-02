import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function CatalogSkeleton() {
  return (
    <div className="bg-surface-container-lowest rounded-2xl shadow-sm border border-outline-variant/30 overflow-hidden">
      <Table>
        <TableHeader className="bg-surface-container">
          <TableRow>
            <TableHead className="w-[80px] text-center">Slot</TableHead>
            <TableHead className="w-[60px]">Cover</TableHead>
            <TableHead>Book Details</TableHead>
            <TableHead className="w-[120px]">Type</TableHead>
            <TableHead className="w-[120px]">Language</TableHead>
            <TableHead className="w-[160px]">Editions</TableHead>
            <TableHead className="w-[60px] text-center">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-6 w-8 mx-auto" /></TableCell>
              <TableCell><Skeleton className="h-18 w-12" /></TableCell>
              <TableCell>
                <Skeleton className="h-4 w-32 mb-1" />
                <Skeleton className="h-3 w-24" />
              </TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-16" /></TableCell>
              <TableCell><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-6 w-6 mx-auto" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}