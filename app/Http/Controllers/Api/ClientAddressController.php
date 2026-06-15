<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ClientAddress;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ClientAddressController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $addresses = $request->user()
            ->clientAddresses()
            ->orderByDesc('is_default')
            ->latest()
            ->get();

        return response()->json(['data' => $addresses]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $address = DB::transaction(function () use ($request, $validated) {
            if (($validated['is_default'] ?? false) || ! $request->user()->clientAddresses()->exists()) {
                $request->user()->clientAddresses()->update(['is_default' => false]);
                $validated['is_default'] = true;
            }

            return $request->user()->clientAddresses()->create($validated);
        });

        return response()->json($address, 201);
    }

    public function update(Request $request, ClientAddress $address): JsonResponse
    {
        $this->authorizeAddress($request, $address);
        $validated = $request->validate($this->rules(true));

        DB::transaction(function () use ($request, $address, $validated) {
            if ($validated['is_default'] ?? false) {
                $request->user()->clientAddresses()->whereKeyNot($address->id)->update(['is_default' => false]);
            }

            $address->update($validated);
        });

        return response()->json($address->fresh());
    }

    public function destroy(Request $request, ClientAddress $address): JsonResponse
    {
        $this->authorizeAddress($request, $address);

        DB::transaction(function () use ($request, $address) {
            $wasDefault = $address->is_default;
            $address->delete();

            if ($wasDefault) {
                $nextAddress = $request->user()->clientAddresses()->latest()->first();
                $nextAddress?->update(['is_default' => true]);
            }
        });

        return response()->json(['message' => 'Address deleted.']);
    }

    public function makeDefault(Request $request, ClientAddress $address): JsonResponse
    {
        $this->authorizeAddress($request, $address);

        DB::transaction(function () use ($request, $address) {
            $request->user()->clientAddresses()->whereKeyNot($address->id)->update(['is_default' => false]);
            $address->update(['is_default' => true]);
        });

        return response()->json($address->fresh());
    }

    private function rules(bool $partial = false): array
    {
        return [
            'label' => [$partial ? 'sometimes' : 'required', 'string', 'max:100'],
            'recipient_name' => [$partial ? 'sometimes' : 'required', 'string', 'max:255'],
            'phone' => [$partial ? 'sometimes' : 'required', 'string', 'max:30'],
            'address' => [$partial ? 'sometimes' : 'required', 'string', 'max:1000'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'is_default' => ['nullable', 'boolean'],
            'note' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function authorizeAddress(Request $request, ClientAddress $address): void
    {
        if ((int) $address->user_id !== (int) $request->user()->id) {
            abort(403);
        }
    }
}
