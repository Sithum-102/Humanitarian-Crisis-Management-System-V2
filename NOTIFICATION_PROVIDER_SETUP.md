# HUMANAID Email and SMS Setup

The API code already supports SMTP email and Twilio SMS. Provider credentials are deliberately kept outside the source code.

## Local development: Gmail SMTP

1. Use the Gmail account that should send HUMANAID notifications. Enable Google 2-Step Verification, then create an App Password from Google Account > Security > App passwords. Use the generated app password, not the normal Gmail password.
2. Open PowerShell in `HumanitarianCrisis.API` and run these commands. Replace the placeholders locally; do not commit them or paste them into chat.

```powershell
dotnet user-secrets init
dotnet user-secrets set "Notifications:Email:SmtpHost" "smtp.gmail.com"
dotnet user-secrets set "Notifications:Email:Port" "587"
dotnet user-secrets set "Notifications:Email:EnableSsl" "true"
dotnet user-secrets set "Notifications:Email:From" "YOUR_GMAIL_ADDRESS"
dotnet user-secrets set "Notifications:Email:Username" "YOUR_GMAIL_ADDRESS"
dotnet user-secrets set "Notifications:Email:Password" "YOUR_GOOGLE_APP_PASSWORD"
```

Google documents `smtp.gmail.com`, authenticated SMTP, TLS/STARTTLS on port 587. App passwords require 2-Step Verification and may be unavailable for some managed or security-restricted accounts.

## Local development: Twilio SMS

1. Create a Twilio account, complete its Messaging setup, and get the Account SID, Auth Token, and an SMS-capable Twilio sender number from the Twilio Console.
2. In a trial account, add and verify the recipient phone number you will test with.
3. In the API PowerShell terminal, set the secrets:

```powershell
dotnet user-secrets set "Notifications:Sms:TwilioAccountSid" "YOUR_TWILIO_ACCOUNT_SID"
dotnet user-secrets set "Notifications:Sms:TwilioAuthToken" "YOUR_TWILIO_AUTH_TOKEN"
dotnet user-secrets set "Notifications:Sms:TwilioFromNumber" "+1YOUR_TWILIO_NUMBER"
```

Use the sender number exactly as Twilio shows it, in international format. Trial accounts restrict recipients to verified numbers and add trial wording to SMS. Trial access/credits are limited; sending to general public numbers requires an eligible paid setup and can incur charges. Check Twilio's current Sri Lanka SMS rules and availability before relying on it for real emergency alerts; carrier and sender restrictions apply.

## Hosting

Set the same values as **environment/app settings on the backend API host only** (not in React/Vite and not in a committed `appsettings.json`). Use .NET environment-variable names such as:

- `Notifications__Email__SmtpHost`, `Notifications__Email__Port`, `Notifications__Email__EnableSsl`, `Notifications__Email__From`, `Notifications__Email__Username`, `Notifications__Email__Password`
- `Notifications__Sms__TwilioAccountSid`, `Notifications__Sms__TwilioAuthToken`, `Notifications__Sms__TwilioFromNumber`

Restart/redeploy the API after setting them. The API returns `Sent`, `NotConfigured`, or `Failed` per contact channel. A `Sent` result means the provider accepted the message for delivery; it does not prove the recipient received or read it. If no provider is configured, requests are still saved, and notification status reports `NotConfigured`.

Never add real credentials to Git, screenshots, or public issue trackers. If a credential is exposed, revoke/rotate it in the provider account.

## Provider references

- Google App Passwords: https://support.google.com/accounts/answer/185833
- Gmail SMTP settings: https://support.google.com/mail/answer/7104828
- Twilio trial restrictions: https://www.twilio.com/docs/usage/tutorials/how-to-use-your-free-trial-account
- Twilio Sri Lanka SMS guidance: https://www.twilio.com/en-us/guidelines/lk/sms
