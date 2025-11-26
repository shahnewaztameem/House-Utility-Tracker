<?php

namespace App\Http\Controllers\Api;

use App\Actions\Billing\SyncBillMetrics;
use App\Http\Controllers\Controller;
use App\Http\Requests\StorePaymentRequest;
use App\Http\Resources\PaymentResource;
use App\Models\BillShare;
use App\Models\Payment;
use App\Models\User;
use App\Services\TelegramBotService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class PaymentController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $query = Payment::query()
            ->with(['recordedBy', 'billShare.bill'])
            ->latest('paid_on');

        if ($request->filled('bill_share_id')) {
            $query->where('bill_share_id', $request->integer('bill_share_id'));
        }

        if (! $user->isAdmin()) {
            $query->whereHas('billShare', fn ($builder) => $builder->where('user_id', $user->id));
        }

        if ($request->boolean('paginate')) {
            return PaymentResource::collection(
                $query->paginate($request->integer('per_page', 15))->withQueryString()
            );
        }

        return PaymentResource::collection($query->get());
    }

    public function store(StorePaymentRequest $request): PaymentResource
    {
        $data = $request->validated();

        /** @var BillShare $share */
        $share = BillShare::with('bill')->findOrFail($data['bill_share_id']);

        $this->ensurePaymentAccess($request->user(), $share);

        $payment = DB::transaction(function () use ($share, $data, $request) {
            /** @var Payment $payment */
            $payment = $share->payments()->create([
                'recorded_by' => $request->user()->id,
                'amount' => round((float) $data['amount'], 2),
                'paid_on' => $data['paid_on'],
                'method' => $data['method'] ?? 'cash',
                'reference' => $data['reference'] ?? null,
                'notes' => $data['notes'] ?? null,
            ]);

            $share->forceFill([
                'amount_paid' => round($share->amount_paid + $payment->amount, 2),
                'last_paid_at' => $payment->paid_on,
            ])->save();

            SyncBillMetrics::share($share->fresh('bill'));

            return $payment->fresh(['recordedBy', 'billShare.bill']);
        });

        // Send Telegram notification
        try {
            $botService = app(TelegramBotService::class);
            $botService->sendPaymentNotification($payment);
        } catch (\Exception $e) {
            // Log but don't fail the payment
            \Log::error('Failed to send Telegram payment notification', [
                'error' => $e->getMessage(),
            ]);
        }

        return new PaymentResource($payment);
    }

    public function destroy(Request $request, Payment $payment): JsonResponse
    {
        $share = $payment->billShare;
        
        // Ensure user has access to this payment (residents cannot delete payments)
        if ($share) {
            $this->ensurePaymentAccess($request->user(), $share);
            
            // Residents cannot delete payments - only admins can
            if (!$request->user()->isAdmin()) {
                abort(Response::HTTP_FORBIDDEN, 'You do not have permission to delete payments. Contact an administrator.');
            }
        }

        DB::transaction(function () use ($payment, $share) {
            $amount = $payment->amount;
            $payment->delete();

            if ($share) {
                $share->amount_paid = max($share->amount_paid - $amount, 0);
                $share->last_paid_at = $share->payments()->latest('paid_on')->value('paid_on');
                $share->save();
                SyncBillMetrics::share($share->fresh('bill'));
            }
        });

        return response()->json(['message' => 'Payment removed.']);
    }

    protected function ensurePaymentAccess(?User $user, BillShare $share): void
    {
        if (! $user) {
            abort(Response::HTTP_UNAUTHORIZED);
        }

        if ($user->isAdmin() || $share->user_id === $user->id) {
            return;
        }

        abort(Response::HTTP_FORBIDDEN, 'You cannot add payments for this share.');
    }
}
