<?php

namespace App\Http\Requests;

use App\Models\User;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Auth;

class StoreDeliveryOrderRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     *
     * @return bool
     */
    public function authorize()
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules()
    {
        $user = $this->user() ?? Auth::guard('sanctum')->user();
        $isOfficeUser = $user?->hasAnyRole([
            User::ROLE_OFFICE_ADMIN,
            User::ROLE_SUPER_ADMIN,
        ]) ?? false;
        $isClientUser = $user?->role === User::ROLE_CLIENT;
        $requesterRules = $isOfficeUser ? ['nullable'] : ['required'];
        $destinationRules = ($isOfficeUser || $isClientUser) ? ['nullable'] : ['required'];

        return [
            'client_name' => [...$requesterRules, 'string', 'max:255'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'shop_id' => ['nullable', 'integer', 'exists:shops,id'],
            'client_phone' => [...$requesterRules, 'string', 'max:30'],
            'pickup_contact_name' => ['required', 'string', 'max:255'],
            'pickup_phone' => ['required', 'string', 'max:30'],
            'pickup_address' => ['required', 'string', 'max:1000'],
            'pickup_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'pickup_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'receiver_name' => [...$destinationRules, 'string', 'max:255'],
            'receiver_phone' => [...$destinationRules, 'string', 'max:30'],
            'receiver_address' => [...$destinationRules, 'string', 'max:1000'],
            'receiver_latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'receiver_longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'product_name' => ['required', 'string', 'max:255'],
            'product_category' => ['nullable', 'string', 'max:100'],
            'quantity' => ['nullable', 'integer', 'min:1', 'max:999'],
            'product_value' => ['nullable', 'numeric', 'min:0'],
            'is_fragile' => ['nullable', 'boolean'],
            'special_handling_note' => ['nullable', 'string', 'max:1000'],
            'delivery_fee_payment_method' => ['nullable', 'in:cash,mobile_banking'],
            'product_payment_method' => ['nullable', 'in:already_paid,rider_collects'],
            'cod_amount' => ['nullable', 'numeric', 'min:0'],
            'prepaid_amount' => ['nullable', 'numeric', 'min:0'],
            'delivery_fee' => ['nullable', 'numeric', 'min:0'],
            'client_note' => ['nullable', 'string', 'max:1000'],
        ];
    }
}
