<?php

namespace App\Services;

use App\Helpers\CurrencyHelper;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class TelegramService
{
    protected string $botToken;
    protected string $apiUrl;

    public function __construct()
    {
        $this->botToken = config('services.telegram.bot_token', '');
        $this->apiUrl = "https://api.telegram.org/bot{$this->botToken}";
    }

    /**
     * Send a message to a Telegram chat
     *
     * @param string $chatId The Telegram chat ID
     * @param string $message The message to send
     * @param string|null $parseMode Parse mode (HTML or Markdown)
     * @return bool
     */
    public function sendMessage(string $chatId, string $message, ?string $parseMode = 'HTML'): bool
    {
        if (empty($this->botToken)) {
            Log::warning('Telegram bot token is not configured');
            return false;
        }

        if (empty($chatId)) {
            Log::warning('Telegram chat ID is empty');
            return false;
        }

        try {
            $response = Http::post("{$this->apiUrl}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => $parseMode,
            ]);

            if ($response->successful()) {
                return true;
            }

            Log::error('Failed to send Telegram message', [
                'chat_id' => $chatId,
                'response' => $response->body(),
            ]);

            return false;
        } catch (\Exception $e) {
            Log::error('Exception while sending Telegram message', [
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Send a message with inline keyboard
     *
     * @param string $chatId The Telegram chat ID
     * @param string $message The message to send
     * @param array $keyboard The inline keyboard structure
     * @param string|null $parseMode Parse mode (HTML or Markdown)
     * @return bool
     */
    public function sendMessageWithKeyboard(string $chatId, string $message, array $keyboard, ?string $parseMode = 'HTML'): bool
    {
        if (empty($this->botToken)) {
            Log::warning('Telegram bot token is not configured');
            return false;
        }

        if (empty($chatId)) {
            Log::warning('Telegram chat ID is empty');
            return false;
        }

        try {
            // Log keyboard structure for debugging
            Log::debug('Sending message with keyboard', [
                'chat_id' => $chatId,
                'keyboard' => $keyboard,
                'keyboard_json' => json_encode($keyboard),
            ]);

            $response = Http::post("{$this->apiUrl}/sendMessage", [
                'chat_id' => $chatId,
                'text' => $message,
                'parse_mode' => $parseMode,
                'reply_markup' => json_encode($keyboard),
            ]);

            if ($response->successful()) {
                $responseData = $response->json();
                Log::debug('Message sent successfully', [
                    'chat_id' => $chatId,
                    'message_id' => $responseData['result']['message_id'] ?? null,
                ]);
                return true;
            }

            Log::error('Failed to send Telegram message with keyboard', [
                'chat_id' => $chatId,
                'response' => $response->body(),
                'status' => $response->status(),
            ]);

            return false;
        } catch (\Exception $e) {
            Log::error('Exception while sending Telegram message with keyboard', [
                'chat_id' => $chatId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Answer a callback query
     *
     * @param string $callbackQueryId The callback query ID
     * @param string|null $text Optional text to show to user
     * @return bool
     */
    public function answerCallbackQuery(string $callbackQueryId, ?string $text = null): bool
    {
        if (empty($this->botToken)) {
            return false;
        }

        try {
            $params = [
                'callback_query_id' => $callbackQueryId,
                'show_alert' => false,
            ];
            
            // Only add text if it's not null/empty to avoid showing "null" to user
            if (!empty($text)) {
                $params['text'] = $text;
            }
            
            $response = Http::post("{$this->apiUrl}/answerCallbackQuery", $params);

            return $response->successful();
        } catch (\Exception $e) {
            Log::error('Exception while answering callback query', [
                'callback_query_id' => $callbackQueryId,
                'error' => $e->getMessage(),
            ]);

            return false;
        }
    }

    /**
     * Format a bill breakdown message for Telegram
     *
     * @param \App\Models\Bill $bill
     * @return string
     */
    public function formatBillMessage(\App\Models\Bill $bill): string
    {
        $message = "📋 <b>New Bill Created</b>\n\n";
        $message .= "📅 <b>Month:</b> {$bill->for_month}\n";
        $message .= "🔖 <b>Reference:</b> {$bill->reference}\n";

        if ($bill->due_date) {
            $message .= "⏰ <b>Due Date:</b> {$bill->due_date->format('Y-m-d')}\n";
        }

        if ($bill->period_start && $bill->period_end) {
            $message .= "📆 <b>Period:</b> {$bill->period_start->format('Y-m-d')} to {$bill->period_end->format('Y-m-d')}\n";
        }

        $message .= "\n💰 <b>Breakdown:</b>\n";

        $currencySymbol = CurrencyHelper::symbol();

        // Add line items
        if (!empty($bill->line_items) && is_array($bill->line_items)) {
            foreach ($bill->line_items as $item) {
                $label = $item['label'] ?? $item['key'] ?? 'Unknown';
                $amount = number_format((float) ($item['amount'] ?? 0), 2);
                $message .= "  • {$label}: {$currencySymbol}{$amount}\n";
            }
        }

        // Add electricity details if present
        if ($bill->electricity_units > 0) {
            $message .= "\n⚡ <b>Electricity:</b>\n";
            if ($bill->electricity_start_unit && $bill->electricity_end_unit) {
                $message .= "  • Start Unit: {$bill->electricity_start_unit}\n";
                $message .= "  • End Unit: {$bill->electricity_end_unit}\n";
            }
            $message .= "  • Units Used: {$bill->electricity_units}\n";
            if ($bill->electricity_rate > 0) {
                $message .= "  • Rate: {$currencySymbol}" . number_format((float) $bill->electricity_rate, 2) . " per unit\n";
            }
            $message .= "  • Amount: {$currencySymbol}" . number_format((float) $bill->electricity_bill, 2) . "\n";
        }

        // Add user's share if available
        if ($bill->relationLoaded('shares')) {
            $message .= "\n👥 <b>Your Share:</b>\n";
            $userShare = $bill->shares->first();
            if ($userShare) {
                $message .= "  • Amount Due: {$currencySymbol}" . number_format((float) $userShare->amount_due, 2) . "\n";
                if ($userShare->amount_paid > 0) {
                    $message .= "  • Amount Paid: {$currencySymbol}" . number_format((float) $userShare->amount_paid, 2) . "\n";
                    $outstanding = $userShare->amount_due - $userShare->amount_paid;
                    if ($outstanding > 0) {
                        $message .= "  • Outstanding: {$currencySymbol}" . number_format((float) $outstanding, 2) . "\n";
                    }
                }
            }
        }

        if ($bill->notes) {
            $message .= "\n📝 <b>Notes:</b> {$bill->notes}\n";
        }

        $message .= "\n✅ Bill created successfully!";

        return $message;
    }
}

