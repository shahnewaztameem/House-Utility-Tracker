<?php

namespace App\Console\Commands;

use App\Services\TelegramBotService;
use Illuminate\Console\Command;

class SendMonthlyDueNotifications extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'telegram:send-monthly-due-notifications';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Send monthly due notifications to all residents via Telegram';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $this->info('Sending monthly due notifications...');

        try {
            $botService = app(TelegramBotService::class);
            $botService->sendMonthlyDueNotification();

            $this->info('Monthly due notifications sent successfully!');
            return Command::SUCCESS;
        } catch (\Exception $e) {
            $this->error('Failed to send monthly due notifications: ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
