import { TelemarketingKanban } from "@/components/telemarketing/TelemarketingKanban";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default function Kanban() {
    return (
        <DashboardLayout>
            <TelemarketingKanban />
        </DashboardLayout>
    );
}
