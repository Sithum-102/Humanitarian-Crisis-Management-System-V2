using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Net.Mail;
using System.Text;

namespace HumanitarianCrisis.API.Services;

public sealed record DeliveryResult(string Status, string? Error = null);

public sealed class NotificationDeliveryService(IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<NotificationDeliveryService> logger)
{
    public async Task<DeliveryResult> SendAsync(string channel, string recipient, string subject, string message, CancellationToken cancellationToken)
    {
        if (channel == "Email") return await SendEmailAsync(recipient, subject, message, cancellationToken);
        if (channel == "SMS") return await SendSmsAsync(recipient, message, cancellationToken);
        return new DeliveryResult("Failed", "Unsupported notification channel.");
    }

    private async Task<DeliveryResult> SendEmailAsync(string recipient, string subject, string message, CancellationToken cancellationToken)
    {
        var from = configuration["Notifications:Email:From"];
        var brevoKey = configuration["Notifications:Email:BrevoApiKey"];
        if (!string.IsNullOrWhiteSpace(brevoKey) && !string.IsNullOrWhiteSpace(from))
            return await SendBrevoEmailAsync(brevoKey, from, recipient, subject, message, cancellationToken);

        var resendKey = configuration["Notifications:Email:ResendApiKey"];
        if (!string.IsNullOrWhiteSpace(resendKey) && !string.IsNullOrWhiteSpace(from))
            return await SendResendEmailAsync(resendKey, from, recipient, subject, message, cancellationToken);

        var host = configuration["Notifications:Email:SmtpHost"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(from))
            return new DeliveryResult("NotConfigured", "Email provider settings are not configured.");

        try
        {
            using var mail = new MailMessage(from, recipient, subject, message) { IsBodyHtml = false };
            using var client = new SmtpClient(host, configuration.GetValue("Notifications:Email:Port", 587))
            {
                EnableSsl = configuration.GetValue("Notifications:Email:EnableSsl", true),
                DeliveryMethod = SmtpDeliveryMethod.Network,
                Timeout = 15000
            };
            var username = configuration["Notifications:Email:Username"];
            var password = configuration["Notifications:Email:Password"];
            if (!string.IsNullOrWhiteSpace(username)) client.Credentials = new NetworkCredential(username, password);
            await client.SendMailAsync(mail, cancellationToken);
            return new DeliveryResult("Sent");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Email delivery failed.");
            return new DeliveryResult("Failed", "SMTP delivery failed. Check the server logs and provider settings.");
        }
    }

    private async Task<DeliveryResult> SendBrevoEmailAsync(string apiKey, string from, string recipient, string subject, string message, CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient("email");
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
            request.Headers.Add("api-key", apiKey);
            request.Content = JsonContent.Create(new
            {
                sender = new { name = "HUMANAID", email = from },
                to = new[] { new { email = recipient } },
                subject,
                textContent = message
            });
            using var response = await client.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode) return new DeliveryResult("Sent");
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning("Brevo email delivery returned HTTP {StatusCode}: {Body}", (int)response.StatusCode, body);
            return new DeliveryResult("Failed", $"Brevo rejected the email (HTTP {(int)response.StatusCode}).");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Brevo email delivery failed.");
            return new DeliveryResult("Failed", "Brevo email delivery failed. Check the server logs.");
        }
    }

    private async Task<DeliveryResult> SendResendEmailAsync(string apiKey, string from, string recipient, string subject, string message, CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient("email");
            using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.resend.com/emails");
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            request.Content = JsonContent.Create(new
            {
                from,
                to = new[] { recipient },
                subject,
                text = message
            });
            using var response = await client.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode) return new DeliveryResult("Sent");
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning("Resend email delivery returned HTTP {StatusCode}: {Body}", (int)response.StatusCode, body);
            return new DeliveryResult("Failed", $"Resend rejected the email (HTTP {(int)response.StatusCode}).");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Resend email delivery failed.");
            return new DeliveryResult("Failed", "Resend email delivery failed. Check the server logs.");
        }
    }

    private async Task<DeliveryResult> SendSmsAsync(string recipient, string message, CancellationToken cancellationToken)
    {
        // 1. TextBee Free Android SMS Gateway (uses your Android phone + SIM card)
        var textBeeApiKey = configuration["Notifications:Sms:TextBeeApiKey"];
        var textBeeDeviceId = configuration["Notifications:Sms:TextBeeDeviceId"];
        if (!string.IsNullOrWhiteSpace(textBeeApiKey) && !string.IsNullOrWhiteSpace(textBeeDeviceId))
        {
            return await SendTextBeeSmsAsync(textBeeApiKey, textBeeDeviceId, recipient, message, cancellationToken);
        }

        // 2. Generic HTTP SMS Gateway (e.g. self-hosted Android Gateway / Webhook)
        var gatewayUrl = configuration["Notifications:Sms:GatewayUrl"];
        if (!string.IsNullOrWhiteSpace(gatewayUrl))
        {
            return await SendGenericGatewaySmsAsync(gatewayUrl, recipient, message, cancellationToken);
        }

        // 3. Twilio SMS
        var accountSid = configuration["Notifications:Sms:TwilioAccountSid"];
        var authToken = configuration["Notifications:Sms:TwilioAuthToken"];
        var from = configuration["Notifications:Sms:TwilioFromNumber"];
        if (!string.IsNullOrWhiteSpace(accountSid) && !string.IsNullOrWhiteSpace(authToken) && !string.IsNullOrWhiteSpace(from))
        {
            return await SendTwilioSmsAsync(accountSid, authToken, from, recipient, message, cancellationToken);
        }

        return new DeliveryResult("NotConfigured", "SMS provider settings (Android Gateway or Twilio) are not configured.");
    }

    private async Task<DeliveryResult> SendTextBeeSmsAsync(string apiKey, string deviceId, string recipient, string message, CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(25);

            var endpoint = $"https://api.textbee.dev/api/v1/gateway/devices/{Uri.EscapeDataString(deviceId)}/sendSMS";
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            request.Headers.Add("x-api-key", apiKey);

            var payload = new
            {
                recipients = new[] { recipient },
                message = message
            };
            request.Content = JsonContent.Create(payload);

            using var response = await client.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return new DeliveryResult("Sent");
            }

            var errBody = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning("TextBee Android Gateway error (HTTP {Code}): {Body}", (int)response.StatusCode, errBody);
            return new DeliveryResult("Failed", $"Android Gateway returned HTTP {(int)response.StatusCode}");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "TextBee Android Gateway delivery failed.");
            return new DeliveryResult("Failed", "Android SMS Gateway delivery failed. Check device connection.");
        }
    }

    private async Task<DeliveryResult> SendGenericGatewaySmsAsync(string gatewayUrl, string recipient, string message, CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(20);
            var apiKey = configuration["Notifications:Sms:GatewayApiKey"];

            using var request = new HttpRequestMessage(HttpMethod.Post, gatewayUrl);
            if (!string.IsNullOrWhiteSpace(apiKey))
            {
                request.Headers.Add("x-api-key", apiKey);
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
            }

            var payload = new
            {
                to = recipient,
                phone = recipient,
                message = message
            };
            request.Content = JsonContent.Create(payload);

            using var response = await client.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return new DeliveryResult("Sent");
            }
            return new DeliveryResult("Failed", $"Gateway returned HTTP {(int)response.StatusCode}");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Generic SMS Gateway delivery failed.");
            return new DeliveryResult("Failed", "SMS Gateway request failed.");
        }
    }

    private async Task<DeliveryResult> SendTwilioSmsAsync(string accountSid, string authToken, string from, string recipient, string message, CancellationToken cancellationToken)
    {
        try
        {
            var client = httpClientFactory.CreateClient("twilio");
            using var request = new HttpRequestMessage(HttpMethod.Post, $"https://api.twilio.com/2010-04-01/Accounts/{Uri.EscapeDataString(accountSid)}/Messages.json");
            var credentials = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", credentials);
            request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["To"] = recipient,
                ["From"] = from,
                ["Body"] = message
            });
            using var response = await client.SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode) return new DeliveryResult("Sent");
            logger.LogWarning("Twilio SMS delivery returned HTTP {StatusCode}.", (int)response.StatusCode);
            return new DeliveryResult("Failed", $"Twilio rejected the SMS (HTTP {(int)response.StatusCode}).");
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Twilio SMS delivery failed.");
            return new DeliveryResult("Failed", "Twilio SMS delivery failed. Check provider settings.");
        }
    }
}
