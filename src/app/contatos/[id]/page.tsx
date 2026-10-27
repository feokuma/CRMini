import ContactForm from "@/components/contact-form";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ContactForm id={id} />;
}
