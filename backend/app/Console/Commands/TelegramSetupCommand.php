<?php

namespace App\Console\Commands;

use App\Services\TelegramService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Http;

class TelegramSetupCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'telegram:setup {action?} {--url=}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Setup and test Telegram bot integration';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $action = $this->argument('action') ?? 'info';

        match ($action) {
            'info' => $this->showInfo(),
            'webhook' => $this->setupWebhook(),
            'test' => $this->testConnection(),
            'delete-webhook' => $this->deleteWebhook(),
            default => $this->error("Unknown action: {$action}. Available: info, webhook, test, delete-webhook"),
        };
    }

    protected function showInfo(): void
    {
        $botToken = config('services.telegram.bot_token');

        $this->info('Telegram Bot Configuration');
        $this->line('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (empty($botToken)) {
            $this->error('❌ Bot token not configured!');
            $this->line('');
            $this->line('Please add TELEGRAM_BOT_TOKEN to your .env file');
            $this->line('Get your bot token from @BotFather on Telegram');
            return;
        }

        $this->info('✅ Bot token is configured');
        $this->line('Token: ' . substr($botToken, 0, 10) . '...');

        // Get bot info
        try {
            $response = Http::get("https://api.telegram.org/bot{$botToken}/getMe");
            if ($response->successful()) {
                $botInfo = $response->json('result');
                $this->line('Bot Name: ' . ($botInfo['first_name'] ?? 'N/A'));
                $this->line('Bot Username: @' . ($botInfo['username'] ?? 'N/A'));
            }
        } catch (\Exception $e) {
            $this->warn('Could not fetch bot info: ' . $e->getMessage());
        }

        $this->line('');
        $this->info('Available Commands:');
        $this->line('  php artisan telegram:setup webhook --url=https://yourdomain.com');
        $this->line('  php artisan telegram:setup test');
        $this->line('  php artisan telegram:setup delete-webhook');
    }

    protected function setupWebhook(): void
    {
        $botToken = config('services.telegram.bot_token');

        if (empty($botToken)) {
            $this->error('Bot token not configured!');
            return;
        }

        $url = $this->option('url') ?? config('app.url');

        if (empty($url)) {
            $this->error('Webhook URL is required. Use --url option or set APP_URL in .env');
            return;
        }

        // Check if URL is HTTP (not HTTPS)
        if (str_starts_with($url, 'http://') && !str_contains($url, 'localhost') && !str_contains($url, '127.0.0.1')) {
            $this->warn('⚠️  Warning: Telegram requires HTTPS for webhooks (except localhost)');
            $this->line('For local development, consider using ngrok or similar tool.');
            if (!$this->confirm('Continue anyway?', false)) {
                return;
            }
        }

        // For localhost HTTP, Telegram allows it but warn the user
        if (str_starts_with($url, 'http://localhost') || str_starts_with($url, 'http://127.0.0.1')) {
            $this->warn('⚠️  Telegram requires HTTPS for webhooks, even for localhost.');
            $this->line('');
            $this->line('For local development, you have two options:');
            $this->line('1. Use ngrok to create an HTTPS tunnel:');
            $this->line('   - Install ngrok: https://ngrok.com/');
            $this->line('   - Run: ngrok http 8000');
            $this->line('   - Use the HTTPS URL provided by ngrok');
            $this->line('');
            $this->line('2. Skip webhook setup for now and use polling or manual chat ID entry');
            $this->line('');
            
            if (!$this->confirm('Do you want to continue with HTTP (will fail)?', false)) {
                $this->info('Webhook setup cancelled. Use ngrok for local development.');
                return;
            }
        }

        $webhookUrl = rtrim($url, '/') . '/api/telegram/webhook';

        $this->info("Setting up webhook...");
        $this->line("URL: {$webhookUrl}");

        try {
            $response = Http::get("https://api.telegram.org/bot{$botToken}/setWebhook", [
                'url' => $webhookUrl,
            ]);

            if ($response->successful() && $response->json('ok')) {
                $this->info('✅ Webhook set successfully!');
                $this->line('');
                $this->line('Users can now:');
                $this->line('  - Send /start or /getid to get their chat ID');
                $this->line('  - Send /link email@example.com to link their account');
            } else {
                $error = $response->json('description', 'Unknown error');
                $this->error('❌ Failed to set webhook');
                $this->line('Error: ' . $error);
                
                if (str_contains($error, 'HTTPS')) {
                    $this->line('');
                    $this->warn('💡 Solution for local development:');
                    $this->line('1. Install ngrok: https://ngrok.com/');
                    $this->line('2. Run: ngrok http 8000 (or your Laravel port)');
                    $this->line('3. Copy the HTTPS URL (e.g., https://abc123.ngrok.io)');
                    $this->line('4. Run: php artisan telegram:setup webhook --url=https://abc123.ngrok.io');
                }
            }
        } catch (\Exception $e) {
            $this->error('Error: ' . $e->getMessage());
        }
    }

    protected function testConnection(): void
    {
        $botToken = config('services.telegram.bot_token');

        if (empty($botToken)) {
            $this->error('Bot token not configured!');
            return;
        }

        $chatId = $this->ask('Enter a Telegram chat ID to test (or press Enter to skip)');

        if (empty($chatId)) {
            // Just test bot info
            $this->info('Testing bot connection...');
            try {
                $response = Http::get("https://api.telegram.org/bot{$botToken}/getMe");
                if ($response->successful()) {
                    $botInfo = $response->json('result');
                    $this->info('✅ Bot connection successful!');
                    $this->line('Bot: @' . ($botInfo['username'] ?? 'N/A'));
                } else {
                    $this->error('❌ Failed to connect to bot');
                }
            } catch (\Exception $e) {
                $this->error('Error: ' . $e->getMessage());
            }
            return;
        }

        $message = $this->ask('Enter test message', 'Hello! This is a test message from the billing system.');

        $this->info("Sending test message to chat ID: {$chatId}...");

        $telegramService = app(TelegramService::class);
        $success = $telegramService->sendMessage($chatId, $message);

        if ($success) {
            $this->info('✅ Test message sent successfully!');
        } else {
            $this->error('❌ Failed to send message');
            $this->line('Check logs for details: storage/logs/laravel.log');
        }
    }

    protected function deleteWebhook(): void
    {
        $botToken = config('services.telegram.bot_token');

        if (empty($botToken)) {
            $this->error('Bot token not configured!');
            return;
        }

        if (!$this->confirm('Are you sure you want to delete the webhook?')) {
            return;
        }

        try {
            $response = Http::get("https://api.telegram.org/bot{$botToken}/deleteWebhook");

            if ($response->successful() && $response->json('ok')) {
                $this->info('✅ Webhook deleted successfully!');
            } else {
                $this->error('❌ Failed to delete webhook');
            }
        } catch (\Exception $e) {
            $this->error('Error: ' . $e->getMessage());
        }
    }
}

