interface SendVerificationRequestParams {
  identifier: string;
  url: string;
  provider: { from?: string };
}

export async function sendVerificationRequest({
  identifier: email,
  url,
  provider,
}: SendVerificationRequestParams): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: provider.from,
      to: email,
      subject: "Sign in to VibeSong",
      html: `<p>Click below to sign in to VibeSong:</p><p><a href="${url}">Sign in</a></p>`,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Resend API error: ${res.status} ${text}`);
  }
}
