<?php

namespace App\Services;

use App\Helpers\CurrencyHelper;
use App\Models\Bill;
use App\Models\BillShare;
use App\Models\Payment;
use App\Models\TelegramBotSession;
use App\Models\TelegramVerificationCode;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

class TelegramBotService
{
    protected TelegramService $telegramService;

    public function __construct(TelegramService $telegramService)
    {
        $this->telegramService = $telegramService;
    }

    /**
     * Handle incoming webhook message
     */
    public function handleMessage(array $messageData): void
    {
        // Handle callback queries first (button clicks)
        if (isset($messageData['callback_query'])) {
            $this->handleCallbackQuery($messageData['callback_query']);
            return;
        }

        // Handle regular messages
        if (!isset($messageData['message'])) {
            Log::warning('Telegram webhook received without message or callback_query', $messageData);
            return;
        }

        $message = $messageData['message'];
        $chatId = (string) $message['chat']['id'];
        $text = $message['text'] ?? '';

        Log::info('Processing Telegram message', [
            'chat_id' => $chatId,
            'text' => $text,
        ]);

        // Handle text messages
        $session = TelegramBotSession::firstOrCreate(
            ['chat_id' => $chatId],
            ['state' => 'start']
        );

        // Auto-authenticate if user has telegram_chat_id set (persistent login)
        if ($session->state !== 'authenticated' || !$session->user_id) {
            $user = User::where('telegram_chat_id', $chatId)->first();
            if ($user) {
                $session->update([
                    'user_id' => $user->id,
                    'state' => 'authenticated',
                ]);
            }
        }

        // Handle commands
        if (str_starts_with($text, '/')) {
            $this->handleCommand($chatId, $text, $session);
            return;
        }

        // Handle state-based messages
        $this->handleStateMessage($chatId, $text, $session);
    }

    /**
     * Handle commands
     */
    protected function handleCommand(string $chatId, string $text, TelegramBotSession $session): void
    {
        $command = strtolower(explode(' ', $text)[0]);

        match ($command) {
            '/start' => $this->handleStartCommand($chatId, $session),
            '/menu' => $this->showMainMenu($chatId, $session),
            '/help' => $this->showHelp($chatId),
            default => $this->telegramService->sendMessage($chatId, "Unknown command. Use /start or /menu to begin."),
        };
    }

    /**
     * Handle /start command - check if already authenticated
     */
    protected function handleStartCommand(string $chatId, TelegramBotSession $session): void
    {
        // Check if user is already authenticated via telegram_chat_id
        $user = User::where('telegram_chat_id', $chatId)->first();
        if ($user) {
            // User is already linked, show menu directly
            $session->update([
                'user_id' => $user->id,
                'state' => 'authenticated',
            ]);
            $this->showMainMenu($chatId, $session);
        } else {
            // New user, show login menu
            $this->showStartMenu($chatId, $session);
        }
    }

    /**
     * Show start menu with login option
     */
    protected function showStartMenu(string $chatId, TelegramBotSession $session): void
    {
        $message = "👋 <b>Welcome to House Utility Billing Bot!</b>\n\n";
        $message .= "Please select an option:";

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '🔐 Login as Resident', 'callback_data' => 'login_resident'],
                ],
            ],
        ];

        $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
        $session->setState('start');
    }

    /**
     * Handle callback queries (button clicks)
     */
    protected function handleCallbackQuery(array $callbackQuery): void
    {
        // Extract chat ID - try multiple possible locations
        $chatId = null;
        if (isset($callbackQuery['message']['chat']['id'])) {
            $chatId = (string) $callbackQuery['message']['chat']['id'];
        } elseif (isset($callbackQuery['from']['id'])) {
            $chatId = (string) $callbackQuery['from']['id'];
        } elseif (isset($callbackQuery['chat']['id'])) {
            $chatId = (string) $callbackQuery['chat']['id'];
        }

        if (!$chatId) {
            Log::error('Callback query missing chat_id', ['callback_query' => $callbackQuery]);
            return;
        }

        $data = $callbackQuery['data'] ?? null;
        $callbackQueryId = $callbackQuery['id'] ?? null;

        Log::info('Processing callback query', [
            'chat_id' => $chatId,
            'data' => $data,
            'callback_query_id' => $callbackQueryId,
            'full_callback' => $callbackQuery,
        ]);

        if (!$data || $data === 'null' || $data === '') {
            Log::error('Callback query missing or null data', [
                'callback_query' => $callbackQuery,
                'chat_id' => $chatId,
            ]);
            if ($callbackQueryId) {
                $this->answerCallbackQuery($callbackQueryId, 'Error: Missing data');
            }
            $this->telegramService->sendMessage($chatId, "❌ Button action failed. Please try /menu to see options.");
            return;
        }

        try {
            // Try to get or create session (handle case where table might not exist)
            try {
                $session = TelegramBotSession::firstOrCreate(
                    ['chat_id' => $chatId],
                    ['state' => 'start']
                );
            } catch (\Exception $e) {
                Log::error('Database error accessing telegram_bot_sessions', [
                    'error' => $e->getMessage(),
                    'chat_id' => $chatId,
                ]);
                // If table doesn't exist, try to authenticate directly via user
                $user = User::where('telegram_chat_id', $chatId)->first();
                if ($user) {
                    // User exists, proceed without session
                    $this->handleCallbackWithoutSession($chatId, $data, $user);
                } else {
                    $this->telegramService->sendMessage($chatId, "❌ Please run database migrations first. Use: php artisan migrate");
                }
                return;
            }

            // Auto-authenticate if user has telegram_chat_id set (persistent login)
            if ($session->state !== 'authenticated' || !$session->user_id) {
                $user = User::where('telegram_chat_id', $chatId)->first();
                if ($user) {
                    $session->update([
                        'user_id' => $user->id,
                        'state' => 'authenticated',
                    ]);
                }
            }

            // Answer callback query first to prevent timeout
            if ($callbackQueryId) {
                $this->answerCallbackQuery($callbackQueryId);
            }

            match (true) {
                $data === 'login_resident' => $this->requestEmail($chatId, $session),
                $data === 'menu' => $this->showMainMenu($chatId, $session),
                $data === 'view_bills' => $this->showBillsMenu($chatId, $session),
                $data === 'view_payments' => $this->showPaymentsSummary($chatId, $session),
                $data === 'view_total_paid' => $this->showTotalPaid($chatId, $session),
                str_starts_with($data, 'bill_') => $this->showBillDetails($chatId, $session, substr($data, 5)),
                str_starts_with($data, 'month_') => $this->showMonthBills($chatId, $session, substr($data, 6)),
                default => $this->telegramService->sendMessage($chatId, "Unknown action. Use /menu to see options."),
            };
        } catch (\Exception $e) {
            Log::error('Error processing callback query', [
                'chat_id' => $chatId,
                'data' => $data,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString(),
            ]);
            if ($callbackQueryId) {
                $this->answerCallbackQuery($callbackQueryId, 'Error occurred');
            }
            $this->telegramService->sendMessage($chatId, "❌ An error occurred. Please try again or use /menu.");
        }
    }

    /**
     * Handle callback without session (fallback when table doesn't exist)
     */
    protected function handleCallbackWithoutSession(string $chatId, string $data, User $user): void
    {
        match (true) {
            $data === 'menu' => $this->showMainMenuDirect($chatId, $user),
            $data === 'view_bills' => $this->showBillsMenuDirect($chatId, $user),
            $data === 'view_payments' => $this->showPaymentsSummaryDirect($chatId, $user),
            $data === 'view_total_paid' => $this->showTotalPaidDirect($chatId, $user),
            default => $this->telegramService->sendMessage($chatId, "Please run migrations: php artisan migrate"),
        };
    }

    /**
     * Show main menu directly (without session)
     */
    protected function showMainMenuDirect(string $chatId, User $user): void
    {
        $message = "📋 <b>Main Menu</b>\n\n";
        $message .= "Hello, {$user->name}!\n\n";
        $message .= "Select an option:";

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '📊 View Bills', 'callback_data' => 'view_bills'],
                ],
                [
                    ['text' => '💰 Payment Summary', 'callback_data' => 'view_payments'],
                ],
                [
                    ['text' => '💵 Total Paid', 'callback_data' => 'view_total_paid'],
                ],
            ],
        ];

        $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
    }

    /**
     * Show bills menu directly (without session)
     */
    protected function showBillsMenuDirect(string $chatId, User $user): void
    {
        try {
            $shares = BillShare::where('user_id', $user->id)
                ->with(['bill'])
                ->orderByDesc('created_at')
                ->get();

            // Group by month
            $monthlyBills = $shares->groupBy(function ($share) {
                return $share->bill->for_month ?? 'Unknown';
            });

            if ($monthlyBills->isEmpty()) {
                $this->telegramService->sendMessage($chatId, "📭 No bills found.");
                return;
            }

            $message = "📊 <b>Your Bills by Month</b>\n\n";
            $keyboardButtons = [];
            $monthIndex = 0;
            $monthMap = [];

            foreach ($monthlyBills->take(12) as $month => $monthShares) {
                $totalDue = $monthShares->sum('amount_due');
                $totalPaid = $monthShares->sum('amount_paid');
                $pending = $totalDue - $totalPaid;

                $message .= "📅 <b>{$month}</b>\n";
                $message .= "   Total: " . CurrencyHelper::format($totalDue) . "\n";
                $message .= "   Paid: " . CurrencyHelper::format($totalPaid) . "\n";
                $message .= "   Pending: " . CurrencyHelper::format($pending) . "\n\n";

                $monthMap[$monthIndex] = $month;
                $keyboardButtons[] = [
                    ['text' => "📅 {$month}", 'callback_data' => "month_{$monthIndex}"],
                ];
                $monthIndex++;
            }

            $keyboardButtons[] = [
                ['text' => '📋 Main Menu', 'callback_data' => 'menu'],
            ];

            $keyboard = ['inline_keyboard' => $keyboardButtons];
            $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
        } catch (\Exception $e) {
            Log::error('Error in showBillsMenuDirect', [
                'chat_id' => $chatId,
                'user_id' => $user->id,
                'error' => $e->getMessage(),
            ]);
            $this->telegramService->sendMessage($chatId, "❌ An error occurred while loading bills.");
        }
    }

    /**
     * Show payments summary directly (without session)
     */
    protected function showPaymentsSummaryDirect(string $chatId, User $user): void
    {
        $shares = BillShare::where('user_id', $user->id)->get();

        $totalDue = $shares->sum('amount_due');
        $totalPaid = $shares->sum('amount_paid');
        $pending = $totalDue - $totalPaid;

        $message = "💰 <b>Payment Summary</b>\n\n";
        $message .= "Total Due: " . CurrencyHelper::format($totalDue) . "\n";
        $message .= "Total Paid: " . CurrencyHelper::format($totalPaid) . "\n";
        $message .= "Pending: " . CurrencyHelper::format($pending) . "\n";

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '📋 Main Menu', 'callback_data' => 'menu'],
                ],
            ],
        ];

        $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
    }

    /**
     * Show total paid directly (without session)
     */
    protected function showTotalPaidDirect(string $chatId, User $user): void
    {
        $totalPaid = Payment::whereHas('billShare', function ($query) use ($user) {
            $query->where('user_id', $user->id);
        })->sum('amount');

        $message = "💵 <b>Total Paid</b>\n\n";
        $message .= "You have paid a total of: " . CurrencyHelper::format($totalPaid);

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '📋 Main Menu', 'callback_data' => 'menu'],
                ],
            ],
        ];

        $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
    }

    /**
     * Request email from user
     */
    protected function requestEmail(string $chatId, TelegramBotSession $session): void
    {
        $message = "📧 <b>Login as Resident</b>\n\n";
        $message .= "Please enter your email address:";

        $this->telegramService->sendMessage($chatId, $message);
        $session->setState('waiting_email');
    }

    /**
     * Handle state-based messages
     */
    protected function handleStateMessage(string $chatId, string $text, TelegramBotSession $session): void
    {
        match ($session->state) {
            'waiting_email' => $this->processEmail($chatId, $text, $session),
            'waiting_code' => $this->processVerificationCode($chatId, $text, $session),
            'authenticated' => $this->handleAuthenticatedMessage($chatId, $text, $session),
            default => $this->showStartMenu($chatId, $session),
        };
    }

    /**
     * Process email input
     */
    protected function processEmail(string $chatId, string $email, TelegramBotSession $session): void
    {
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $this->telegramService->sendMessage($chatId, "❌ Invalid email format. Please enter a valid email address:");
            return;
        }

        $user = User::where('email', $email)->where('role', 'resident')->first();

        if (!$user) {
            $this->telegramService->sendMessage($chatId, "❌ No resident account found with this email. Please contact your administrator.");
            $session->setState('start');
            return;
        }

        // Generate verification code
        $verificationCode = TelegramVerificationCode::generate($email, $chatId);

        // Send verification code via email
        try {
            Mail::raw("Your verification code is: {$verificationCode->code}\n\nThis code will expire in 10 minutes.", function ($message) use ($email) {
                $message->to($email)
                    ->subject('Telegram Bot Verification Code');
            });

            $session->update([
                'state' => 'waiting_code',
                'pending_email' => $email,
            ]);

            $message = "✅ Verification code sent to your email!\n\n";
            $message .= "Please enter the 4-digit code you received:";
            $this->telegramService->sendMessage($chatId, $message);
        } catch (\Exception $e) {
            Log::error('Failed to send verification email', ['error' => $e->getMessage()]);
            $this->telegramService->sendMessage($chatId, "❌ Failed to send verification email. Please try again later.");
            $session->setState('start');
        }
    }

    /**
     * Process verification code
     */
    protected function processVerificationCode(string $chatId, string $code, TelegramBotSession $session): void
    {
        $email = $session->pending_email;

        if (!$email) {
            $this->telegramService->sendMessage($chatId, "❌ Session expired. Please start over with /start");
            $session->setState('start');
            return;
        }

        $verificationCode = TelegramVerificationCode::where('email', $email)
            ->where('chat_id', $chatId)
            ->where('code', $code)
            ->where('used', false)
            ->first();

        if (!$verificationCode || !$verificationCode->isValid()) {
            $this->telegramService->sendMessage($chatId, "❌ Invalid or expired code. Please try again or use /start to begin.");
            return;
        }

        // Verify and link user
        $user = User::where('email', $email)->first();
        if ($user) {
            $user->update(['telegram_chat_id' => $chatId]);
            $session->update([
                'user_id' => $user->id,
                'state' => 'authenticated',
                'pending_email' => null,
            ]);
            $verificationCode->markAsUsed();

            $message = "✅ <b>Successfully authenticated!</b>\n\n";
            $message .= "Welcome, {$user->name}!\n";
            $message .= "You can now access your billing information.";

            $this->showMainMenu($chatId, $session);
        } else {
            $this->telegramService->sendMessage($chatId, "❌ User not found. Please contact your administrator.");
            $session->setState('start');
        }
    }

    /**
     * Show main menu
     */
    protected function showMainMenu(string $chatId, TelegramBotSession $session): void
    {
        // Auto-authenticate if user has telegram_chat_id set (persistent login)
        if ($session->state !== 'authenticated' || !$session->user_id) {
            $user = User::where('telegram_chat_id', $chatId)->first();
            if ($user) {
                $session->update([
                    'user_id' => $user->id,
                    'state' => 'authenticated',
                ]);
            } else {
                $this->showStartMenu($chatId, $session);
                return;
            }
        }

        $user = User::find($session->user_id);
        if (!$user) {
            $this->showStartMenu($chatId, $session);
            return;
        }
        
        $message = "📋 <b>Main Menu</b>\n\n";
        $message .= "Hello, {$user->name}!\n\n";
        $message .= "Select an option:";

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '📊 View Bills', 'callback_data' => 'view_bills'],
                ],
                [
                    ['text' => '💰 Payment Summary', 'callback_data' => 'view_payments'],
                ],
                [
                    ['text' => '💵 Total Paid', 'callback_data' => 'view_total_paid'],
                ],
            ],
        ];

        $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
    }

    /**
     * Show bills menu (month-wise)
     */
    protected function showBillsMenu(string $chatId, TelegramBotSession $session): void
    {
        // Auto-authenticate if user has telegram_chat_id set
        if ($session->state !== 'authenticated' || !$session->user_id) {
            $user = User::where('telegram_chat_id', $chatId)->first();
            if ($user) {
                $session->update([
                    'user_id' => $user->id,
                    'state' => 'authenticated',
                ]);
            } else {
                $this->showStartMenu($chatId, $session);
                return;
            }
        }

        $user = User::find($session->user_id);
        if (!$user) {
            Log::warning('User not found in showBillsMenu', ['session_user_id' => $session->user_id, 'chat_id' => $chatId]);
            $this->showStartMenu($chatId, $session);
            return;
        }

        try {
            $shares = BillShare::where('user_id', $user->id)
                ->with(['bill'])
                ->orderByDesc('created_at')
                ->get();

            // Group by month
            $monthlyBills = $shares->groupBy(function ($share) {
                return $share->bill->for_month ?? 'Unknown';
            });

            if ($monthlyBills->isEmpty()) {
                $this->telegramService->sendMessage($chatId, "📭 No bills found.");
                return;
            }

            $message = "📊 <b>Your Bills by Month</b>\n\n";
            $keyboardButtons = [];
            $monthIndex = 0;
            $monthMap = []; // Store mapping of index to month name

            foreach ($monthlyBills->take(12) as $month => $monthShares) {
                $totalDue = $monthShares->sum('amount_due');
                $totalPaid = $monthShares->sum('amount_paid');
                $pending = $totalDue - $totalPaid;

                $message .= "📅 <b>{$month}</b>\n";
                $message .= "   Total: " . CurrencyHelper::format($totalDue) . "\n";
                $message .= "   Paid: " . CurrencyHelper::format($totalPaid) . "\n";
                $message .= "   Pending: " . CurrencyHelper::format($pending) . "\n\n";

                // Store month mapping and use index for callback_data (to avoid length/special char issues)
                $monthMap[$monthIndex] = $month;
                $keyboardButtons[] = [
                    ['text' => "📅 {$month}", 'callback_data' => "month_{$monthIndex}"],
                ];
                $monthIndex++;
            }

            // Store month map in session for later retrieval
            $session->setData('month_map', $monthMap);

            $keyboardButtons[] = [
                ['text' => '📋 Main Menu', 'callback_data' => 'menu'],
            ];

            $keyboard = ['inline_keyboard' => $keyboardButtons];
            $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
        } catch (\Exception $e) {
            Log::error('Error in showBillsMenu', [
                'chat_id' => $chatId,
                'user_id' => $user->id ?? null,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            $this->telegramService->sendMessage($chatId, "❌ An error occurred while loading bills. Please try again.");
        }
    }

    /**
     * Show bills for a specific month
     */
    protected function showMonthBills(string $chatId, TelegramBotSession $session, string $month): void
    {
        // Auto-authenticate if user has telegram_chat_id set
        if ($session->state !== 'authenticated' || !$session->user_id) {
            $user = User::where('telegram_chat_id', $chatId)->first();
            if ($user) {
                $session->update([
                    'user_id' => $user->id,
                    'state' => 'authenticated',
                ]);
            } else {
                $this->showStartMenu($chatId, $session);
                return;
            }
        }

        $user = User::find($session->user_id);
        if (!$user) {
            $this->showStartMenu($chatId, $session);
            return;
        }

        // Get month name from stored map using index
        try {
            $monthMap = $session->getData('month_map', []);
            $monthIndex = (int) $month;
            
            if (!isset($monthMap[$monthIndex])) {
                // Fallback: try to find by index or use the month parameter directly
                Log::warning('Month not found in map', ['month_index' => $monthIndex, 'map' => $monthMap]);
                $this->telegramService->sendMessage($chatId, "❌ Month not found. Please try again from the bills menu.");
                $this->showBillsMenu($chatId, $session);
                return;
            }
            
            $monthName = $monthMap[$monthIndex];
            
            $shares = BillShare::where('user_id', $user->id)
                ->whereHas('bill', function ($query) use ($monthName) {
                    $query->where('for_month', 'like', "%{$monthName}%");
                })
                ->with(['bill'])
                ->get();

            if ($shares->isEmpty()) {
                $this->telegramService->sendMessage($chatId, "📭 No bills found for {$monthName}.");
                return;
            }

            $message = "📊 <b>Bills for {$monthName}</b>\n\n";
            $keyboardButtons = [];

            foreach ($shares as $share) {
                $bill = $share->bill;
                $outstanding = $share->amount_due - $share->amount_paid;

                $message .= "🔖 <b>{$bill->reference}</b>\n";
                $message .= "   Due: " . CurrencyHelper::format($share->amount_due) . "\n";
                $message .= "   Paid: " . CurrencyHelper::format($share->amount_paid) . "\n";
                $message .= "   Pending: " . CurrencyHelper::format($outstanding) . "\n";
                if ($bill->due_date) {
                    $message .= "   Due Date: " . $bill->due_date->format('Y-m-d') . "\n";
                }
                $message .= "\n";

                $keyboardButtons[] = [
                    ['text' => "View {$bill->reference}", 'callback_data' => "bill_{$bill->id}"],
                ];
            }

            $keyboardButtons[] = [
                ['text' => '🔙 Back', 'callback_data' => 'view_bills'],
                ['text' => '📋 Menu', 'callback_data' => 'menu'],
            ];

            $keyboard = ['inline_keyboard' => $keyboardButtons];
            $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
        } catch (\Exception $e) {
            Log::error('Error in showMonthBills', [
                'chat_id' => $chatId,
                'month' => $month,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            $this->telegramService->sendMessage($chatId, "❌ An error occurred. Please try again.");
        }
    }

    /**
     * Show bill details with full breakdown
     */
    protected function showBillDetails(string $chatId, TelegramBotSession $session, string $billId): void
    {
        // Auto-authenticate if user has telegram_chat_id set
        if ($session->state !== 'authenticated' || !$session->user_id) {
            $user = User::where('telegram_chat_id', $chatId)->first();
            if ($user) {
                $session->update([
                    'user_id' => $user->id,
                    'state' => 'authenticated',
                ]);
            } else {
                $this->showStartMenu($chatId, $session);
                return;
            }
        }

        $user = User::find($session->user_id);
        if (!$user) {
            $this->showStartMenu($chatId, $session);
            return;
        }

        $share = BillShare::where('user_id', $user->id)
            ->whereHas('bill', function ($query) use ($billId) {
                $query->where('id', $billId);
            })
            ->with(['bill'])
            ->first();

        if (!$share) {
            $this->telegramService->sendMessage($chatId, "❌ Bill not found.");
            return;
        }

        $bill = $share->bill->fresh(['shares' => function ($query) use ($user) {
            $query->where('user_id', $user->id);
        }]);

        // Format detailed bill breakdown
        $message = $this->formatDetailedBillMessage($bill, $share);

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '🔙 Back to Bills', 'callback_data' => 'view_bills'],
                    ['text' => '📋 Main Menu', 'callback_data' => 'menu'],
                ],
            ],
        ];

        $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
    }

    /**
     * Format detailed bill message with full breakdown
     */
    protected function formatDetailedBillMessage(Bill $bill, BillShare $share): string
    {
        $currencySymbol = CurrencyHelper::symbol();
        
        $message = "📋 <b>Bill Details</b>\n\n";
        $message .= "🔖 <b>Reference:</b> {$bill->reference}\n";
        $message .= "📅 <b>Month:</b> {$bill->for_month}\n";
        
        if ($bill->due_date) {
            $message .= "⏰ <b>Due Date:</b> {$bill->due_date->format('Y-m-d')}\n";
        }
        
        if ($bill->period_start && $bill->period_end) {
            $message .= "📆 <b>Period:</b> {$bill->period_start->format('Y-m-d')} to {$bill->period_end->format('Y-m-d')}\n";
        }
        
        $message .= "\n💰 <b>Breakdown:</b>\n";
        
        // Line items
        if (!empty($bill->line_items) && is_array($bill->line_items)) {
            foreach ($bill->line_items as $item) {
                $label = $item['label'] ?? $item['key'] ?? 'Unknown';
                $amount = number_format((float) ($item['amount'] ?? 0), 2);
                $message .= "  • {$label}: {$currencySymbol}{$amount}\n";
            }
        }
        
        // Electricity details
        if ($bill->electricity_units > 0) {
            $message .= "\n⚡ <b>Electricity Details:</b>\n";
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
        
        $message .= "\n👤 <b>Your Share:</b>\n";
        $message .= "  • Amount Due: {$currencySymbol}" . number_format((float) $share->amount_due, 2) . "\n";
        $message .= "  • Amount Paid: {$currencySymbol}" . number_format((float) $share->amount_paid, 2) . "\n";
        
        $outstanding = $share->amount_due - $share->amount_paid;
        if ($outstanding > 0) {
            $message .= "  • <b>Outstanding: {$currencySymbol}" . number_format((float) $outstanding, 2) . "</b>\n";
        } else {
            $message .= "  • ✅ <b>Fully Paid</b>\n";
        }
        
        // Payment history
        $payments = $share->payments()->orderBy('paid_on', 'desc')->get();
        if ($payments->isNotEmpty()) {
            $message .= "\n💳 <b>Payment History:</b>\n";
            foreach ($payments->take(5) as $payment) {
                $message .= "  • {$currencySymbol}" . number_format((float) $payment->amount, 2);
                $message .= " on " . $payment->paid_on->format('Y-m-d');
                $message .= " ({$payment->method})";
                if ($payment->reference) {
                    $message .= " - Ref: {$payment->reference}";
                }
                $message .= "\n";
            }
        }
        
        if ($bill->notes) {
            $message .= "\n📝 <b>Notes:</b> {$bill->notes}\n";
        }
        
        return $message;
    }

    /**
     * Show payments summary
     */
    protected function showPaymentsSummary(string $chatId, TelegramBotSession $session): void
    {
        if ($session->state !== 'authenticated' || !$session->user_id) {
            $this->showStartMenu($chatId, $session);
            return;
        }

        $user = User::find($session->user_id);
        if (!$user) {
            $this->showStartMenu($chatId, $session);
            return;
        }
        $shares = BillShare::where('user_id', $user->id)->get();

        $totalDue = $shares->sum('amount_due');
        $totalPaid = $shares->sum('amount_paid');
        $pending = $totalDue - $totalPaid;

        $message = "💰 <b>Payment Summary</b>\n\n";
        $message .= "Total Due: " . CurrencyHelper::format($totalDue) . "\n";
        $message .= "Total Paid: " . CurrencyHelper::format($totalPaid) . "\n";
        $message .= "Pending: " . CurrencyHelper::format($pending) . "\n";

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '📋 Main Menu', 'callback_data' => 'menu'],
                ],
            ],
        ];

        $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
    }

    /**
     * Show total paid
     */
    protected function showTotalPaid(string $chatId, TelegramBotSession $session): void
    {
        // Auto-authenticate if user has telegram_chat_id set
        if ($session->state !== 'authenticated' || !$session->user_id) {
            $user = User::where('telegram_chat_id', $chatId)->first();
            if ($user) {
                $session->update([
                    'user_id' => $user->id,
                    'state' => 'authenticated',
                ]);
            } else {
                $this->showStartMenu($chatId, $session);
                return;
            }
        }

        $user = User::find($session->user_id);
        if (!$user) {
            $this->showStartMenu($chatId, $session);
            return;
        }
        $totalPaid = Payment::whereHas('billShare', function ($query) use ($user) {
            $query->where('user_id', $user->id);
        })->sum('amount');

        $message = "💵 <b>Total Paid</b>\n\n";
        $message .= "You have paid a total of: " . CurrencyHelper::format($totalPaid);

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '📋 Main Menu', 'callback_data' => 'menu'],
                ],
            ],
        ];

        $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
    }

    /**
     * Handle authenticated user messages
     */
    protected function handleAuthenticatedMessage(string $chatId, string $text, TelegramBotSession $session): void
    {
        // For now, just show menu for any text
        $this->showMainMenu($chatId, $session);
    }

    /**
     * Show help
     */
    protected function showHelp(string $chatId): void
    {
        $message = "ℹ️ <b>Help</b>\n\n";
        $message .= "Available commands:\n";
        $message .= "/start - Start the bot or show menu\n";
        $message .= "/menu - Show main menu\n";
        $message .= "/help - Show this help\n\n";
        $message .= "Use the buttons in the menu to navigate.\n\n";
        $message .= "Once logged in, you stay logged in! 🎉";

        $keyboard = [
            'inline_keyboard' => [
                [
                    ['text' => '📋 Main Menu', 'callback_data' => 'menu'],
                ],
            ],
        ];

        $this->sendMessageWithKeyboard($chatId, $message, $keyboard);
    }

    /**
     * Send message with inline keyboard
     */
    protected function sendMessageWithKeyboard(string $chatId, string $message, array $keyboard): void
    {
        $this->telegramService->sendMessageWithKeyboard($chatId, $message, $keyboard);
    }

    /**
     * Answer callback query
     */
    protected function answerCallbackQuery(string $callbackQueryId, ?string $text = null): void
    {
        $this->telegramService->answerCallbackQuery($callbackQueryId, $text);
    }

    /**
     * Send payment notification
     */
    public function sendPaymentNotification(Payment $payment): void
    {
        $share = $payment->billShare;
        $user = $share->user;

        if (!$user || !$user->telegram_chat_id) {
            return;
        }

        $message = "✅ <b>Payment Received</b>\n\n";
        $message .= "Amount: " . CurrencyHelper::format($payment->amount) . "\n";
        $message .= "Date: " . $payment->paid_on->format('Y-m-d') . "\n";
        $message .= "Method: " . ucfirst($payment->method) . "\n";
        $message .= "Bill: {$share->bill->reference}\n";
        $message .= "Month: {$share->bill->for_month}\n\n";

        $outstanding = $share->amount_due - $share->amount_paid;
        if ($outstanding > 0) {
            $message .= "Outstanding: " . CurrencyHelper::format($outstanding) . "\n";
        } else {
            $message .= "✅ Bill fully paid!\n";
        }

        $this->telegramService->sendMessage($user->telegram_chat_id, $message);
    }

    /**
     * Send monthly due notification
     */
    public function sendMonthlyDueNotification(): void
    {
        $users = User::where('role', 'resident')
            ->whereNotNull('telegram_chat_id')
            ->get();

        foreach ($users as $user) {
            $shares = BillShare::where('user_id', $user->id)
                ->whereHas('bill', function ($query) {
                    $query->where('status', '!=', 'paid');
                })
                ->with(['bill'])
                ->get();

            $pendingBills = $shares->filter(function ($share) {
                return ($share->amount_due - $share->amount_paid) > 0;
            });

            if ($pendingBills->isEmpty()) {
                continue;
            }

            $message = "⏰ <b>Monthly Due Reminder</b>\n\n";
            $message .= "You have pending bills:\n\n";

            $totalPending = 0;
            foreach ($pendingBills as $share) {
                $outstanding = $share->amount_due - $share->amount_paid;
                $totalPending += $outstanding;

                $message .= "📋 {$share->bill->for_month} - {$share->bill->reference}\n";
                $message .= "   Due: " . CurrencyHelper::format($share->amount_due) . "\n";
                $message .= "   Paid: " . CurrencyHelper::format($share->amount_paid) . "\n";
                $message .= "   Pending: " . CurrencyHelper::format($outstanding) . "\n";
                if ($share->bill->due_date) {
                    $message .= "   Due Date: " . $share->bill->due_date->format('Y-m-d') . "\n";
                }
                $message .= "\n";
            }

            $message .= "💰 <b>Total Pending: " . CurrencyHelper::format($totalPending) . "</b>\n\n";
            $message .= "Please make your payment soon.";

            $this->telegramService->sendMessage($user->telegram_chat_id, $message);
        }
    }
}

