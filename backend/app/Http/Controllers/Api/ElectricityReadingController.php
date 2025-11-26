<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ElectricityReadingResource;
use App\Models\ElectricityReading;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class ElectricityReadingController extends Controller
{
    protected array $months = [
        'January',
        'February',
        'March',
        'April',
        'May',
        'June',
        'July',
        'August',
        'September',
        'October',
        'November',
        'December',
    ];

    public function index(Request $request): JsonResponse
    {
        $query = ElectricityReading::query()
            ->with('recorder')
            ->orderByDesc('year')
            ->orderByDesc('month');

        if ($request->filled('month')) {
            $query->where('month', $request->string('month'));
        }

        if ($request->filled('year')) {
            $query->where('year', $request->integer('year'));
        }

        if ($request->boolean('paginate')) {
            $readings = $query->paginate($request->integer('per_page', 15))->withQueryString();
            return ElectricityReadingResource::collection($readings)->response();
        }

        $readings = $query->get();
        return ElectricityReadingResource::collection($readings)->response();
    }

    public function show(ElectricityReading $electricityReading): ElectricityReadingResource
    {
        return new ElectricityReadingResource($electricityReading->load('recorder'));
    }

    public function store(Request $request): ElectricityReadingResource
    {
        $data = $this->validateData($request);

        $reading = ElectricityReading::create([
            'month' => $data['month'],
            'year' => $data['year'],
            'start_unit' => $data['start_unit'],
            'end_unit' => $data['end_unit'] ?? null,
            'recorded_by' => $request->user()->id,
        ]);

        return new ElectricityReadingResource($reading->load('recorder'));
    }

    public function update(Request $request, ElectricityReading $electricityReading): ElectricityReadingResource
    {
        $data = $this->validateData($request, true);

        $electricityReading->fill($data)->save();

        return new ElectricityReadingResource($electricityReading->load('recorder'));
    }

    public function destroy(ElectricityReading $electricityReading): JsonResponse
    {
        $electricityReading->delete();

        return response()->json(['message' => 'Electricity reading deleted.']);
    }

    public function byMonthYear(Request $request): JsonResponse
    {
        $data = $request->validate([
            'month' => ['required', 'string', 'in:'.implode(',', $this->months)],
            'year' => ['required', 'integer', 'min:2000'],
        ]);

        $reading = ElectricityReading::query()
            ->where('month', $data['month'])
            ->where('year', $data['year'])
            ->first();

        return response()->json([
            'data' => $reading ? new ElectricityReadingResource($reading) : null,
        ]);
    }

    protected function validateData(Request $request, bool $partial = false): array
    {
        $rules = [
            'month' => [$partial ? 'sometimes' : 'required', 'string', 'in:'.implode(',', $this->months)],
            'year' => [$partial ? 'sometimes' : 'required', 'integer', 'min:2000'],
            'start_unit' => [$partial ? 'sometimes' : 'required', 'integer', 'min:0'],
            'end_unit' => ['nullable', 'integer', 'min:0'],
        ];

        $validated = $request->validate($rules);

        if (array_key_exists('end_unit', $validated)) {
            $start = $validated['start_unit']
                ?? ($partial ? ($request->route('electricityReading')->start_unit ?? null) : null);

            if ($start !== null && $validated['end_unit'] !== null && $validated['end_unit'] < $start) {
                throw ValidationException::withMessages([
                    'end_unit' => 'End unit must be greater than or equal to start unit.',
                ]);
            }
        }

        return $validated;
    }
}
