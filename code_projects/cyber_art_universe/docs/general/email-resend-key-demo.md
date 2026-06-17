
import { Resend } from 'resend';

const resend = new Resend('XXXX'); //API KEY: use cloudflare secret RESEND_API_KEY

resend.emails.send({
  from: 'onboarding@resend.dev',
  to: 'zerglingzl@gmail.com',
  subject: 'Hello World',
  html: '<p>Congrats on sending your <strong>first email</strong>!</p>'
});
