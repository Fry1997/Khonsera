import { PageShell } from "@/components/ui/page-shell";
import { NewCustomerForm } from "./new-customer-form";

export default function NewCustomerPage() {
  return (
    <PageShell
      title="Add customer"
      description="Customers are reusable across visits. Sites and contacts can be added once the customer exists."
    >
      <div className="max-w-xl">
        <NewCustomerForm />
      </div>
    </PageShell>
  );
}
