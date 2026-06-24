import { Resend } from "resend";

const TO = "mafvidal@gmail.com";
const FROM = "onboarding@resend.dev";

type ContactRequest = {
  name?: string;
  email?: string;
  msg?: string;
};

export async function POST(request: Request) {
  let body: ContactRequest;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Campos incompletos" }, { status: 400 });
  }

  const name = body.name?.trim();
  const email = body.email?.trim();
  const msg = body.msg?.trim();

  if (!name || !email || !msg) {
    return Response.json({ error: "Campos incompletos" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "No se pudo enviar" }, { status: 500 });
  }

  const resend = new Resend(apiKey);

  const { error } = await resend.emails.send({
    from: `Arcade Vault <${FROM}>`,
    to: TO,
    replyTo: email,
    subject: `Nuevo mensaje de ${name} — Arcade Vault`,
    text: `Nombre: ${name}\nCorreo: ${email}\n\n${msg}`,
  });

  if (error) {
    return Response.json({ error: "No se pudo enviar" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
