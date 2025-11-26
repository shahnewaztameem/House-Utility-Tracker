<?php

namespace App\Http\Controllers\Api;

use App\Actions\Billing\SyncBillMetrics;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreBillShareRequest;
use App\Http\Requests\UpdateBillShareRequest;
use App\Http\Resources\BillShareResource;
use App\Models\Bill;
use App\Models\BillShare;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Symfony\Component\HttpFoundation\Response;

class BillShareController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();

        $query = BillShare::query()
            ->with(['user', 'bill', 'payments' => fn ($q) => $q->latest('paid_on')])
            ->latest();

        if ($request->filled('bill_id')) {
            $query->where('bill_id', $request->integer('bill_id'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if (! $user->isAdmin()) {
            $query->where('user_id', $user->id);
        }

        if ($request->boolean('paginate')) {
            return BillShareResource::collection(
                $query->paginate($request->integer('per_page', 15))->withQueryString()
            );
        }

        return BillShareResource::collection($query->get());
    }

    public function store(StoreBillShareRequest $request): BillShareResource
    {
        $data = $request->validated();

        /** @var Bill $bill */
        $bill = Bill::findOrFail($data['bill_id']);
        
        // Additional validation: ensure user is a resident
        $user = User::findOrFail($data['user_id']);
        if ($user->role !== 'resident') {
            abort(Response::HTTP_BAD_REQUEST, 'Bill shares can only be assigned to residents. Admin and super_admin users cannot be assigned to bills.');
        }

        $share = $bill->shares()->updateOrCreate(
            ['user_id' => $data['user_id']],
            [
                'amount_due' => round((float) $data['amount_due'], 2),
                'amount_paid' => round((float) ($data['amount_paid'] ?? 0), 2),
                'notes' => $data['notes'] ?? null,
            ]
        );

        SyncBillMetrics::bill($bill->fresh('shares'));

        return new BillShareResource($share->load(['user', 'bill', 'payments']));
    }

    public function show(Request $request, BillShare $billShare): BillShareResource
    {
        $this->ensureShareAccess($request->user(), $billShare);

        return new BillShareResource($billShare->load(['user', 'bill', 'payments']));
    }

    public function update(UpdateBillShareRequest $request, BillShare $billShare): BillShareResource
    {
        // Ensure user has access to this share (residents can only view, not edit)
        $this->ensureShareAccess($request->user(), $billShare);
        
        // Residents cannot edit bill shares - only admins can
        if (!$request->user()->isAdmin()) {
            abort(Response::HTTP_FORBIDDEN, 'You do not have permission to edit bill shares. Contact an administrator.');
        }

        $data = $request->validated();

        if (array_key_exists('amount_due', $data)) {
            $billShare->amount_due = round((float) $data['amount_due'], 2);
        }

        if (array_key_exists('amount_paid', $data)) {
            $billShare->amount_paid = round((float) $data['amount_paid'], 2);
        }

        if (array_key_exists('notes', $data)) {
            $billShare->notes = $data['notes'];
        }

        $billShare->save();

        SyncBillMetrics::share($billShare->fresh('bill'));

        return new BillShareResource($billShare->load(['user', 'bill', 'payments']));
    }

    public function destroy(BillShare $billShare): JsonResponse
    {
        $bill = $billShare->bill;
        $billShare->delete();

        if ($bill) {
            SyncBillMetrics::bill($bill->fresh('shares'));
        }

        return response()->json(['message' => 'Share removed.']);
    }

    protected function ensureShareAccess(?User $user, BillShare $billShare): void
    {
        if (! $user) {
            abort(Response::HTTP_UNAUTHORIZED);
        }

        if ($user->isAdmin() || $billShare->user_id === $user->id) {
            return;
        }

        abort(Response::HTTP_FORBIDDEN, 'You are not allowed to view this share.');
    }
}
