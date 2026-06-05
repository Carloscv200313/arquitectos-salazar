import { AppBrand } from "./app-brand";
import { SidebarNav } from "./sidebar-nav";
import { UserChip } from "./user-chip";

// Desktop sidebar — fixed column. Mobile uses the Sheet in the header.
export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b px-5">
        <AppBrand />
      </div>
      <SidebarNav />
      <div className="border-t p-3">
        <UserChip />
      </div>
    </aside>
  );
}
