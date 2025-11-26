<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\TelegramBotService;
use App\Services\TelegramService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class TelegramController extends Controller
{
    /**
     * Webhook endpoint for Telegram bot updates
     * This allows the bot to receive messages and extract chat IDs
     */
    public function webhook(Request $request): JsonResponse
    {
        $data = $request->all();

        // Log the incoming webhook for debugging
        Log::info('Telegram webhook received', [
            'has_message' => isset($data['message']),
            'has_callback_query' => isset($data['callback_query']),
            'message_text' => $data['message']['text'] ?? null,
            'callback_data' => $data['callback_query']['data'] ?? null,
            'callback_query_full' => $data['callback_query'] ?? null,
            'chat_id' => $data['message']['chat']['id'] ?? $data['callback_query']['message']['chat']['id'] ?? $data['callback_query']['from']['id'] ?? null,
        ]);

        try {
            $botService = app(TelegramBotService::class);
            $botService->handleMessage($data);
        } catch (\Exception $e) {
            Log::error('Error handling Telegram webhook', [
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
        }

        return response()->json(['ok' => true]);
    }

    /**
     * Get current user's Telegram chat ID (if set)
     */
    public function getMyChatId(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        return response()->json([
            'telegram_chat_id' => $user->telegram_chat_id,
            'has_telegram' => !empty($user->telegram_chat_id),
        ]);
    }

    /**
     * Update current user's Telegram chat ID
     */
    public function updateMyChatId(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        $data = $request->validate([
            'telegram_chat_id' => ['required', 'string'],
        ]);

        $user->update(['telegram_chat_id' => $data['telegram_chat_id']]);

        return response()->json([
            'message' => 'Telegram chat ID updated successfully',
            'telegram_chat_id' => $user->telegram_chat_id,
        ]);
    }

    /**
     * Test sending a message to a chat ID (admin only)
     */
    public function testMessage(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized'], 403);
        }

        $data = $request->validate([
            'chat_id' => ['required', 'string'],
            'message' => ['required', 'string'],
        ]);

        $telegramService = app(TelegramService::class);
        $success = $telegramService->sendMessage($data['chat_id'], $data['message']);

        if ($success) {
            return response()->json(['message' => 'Test message sent successfully']);
        }

        return response()->json(['message' => 'Failed to send test message'], 500);
    }
}

