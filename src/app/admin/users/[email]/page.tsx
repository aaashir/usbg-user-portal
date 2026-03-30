import { redirect } from 'next/navigation';
export default function Page({ params }: { params: { email: string } }) {
  redirect(`/admin/contacts/${params.email}`);
}
