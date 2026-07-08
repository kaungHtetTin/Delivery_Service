<?php

namespace App\Http\Requests;

use App\Models\DeliveryOrder;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateDeliveryOrderStatusRequest extends FormRequest
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
        return [
            'status' => ['required', Rule::in(DeliveryOrder::STATUSES)],
            'delivery_fee' => [
                Rule::requiredIf(fn () => $this->input('status') === 'completed'),
                'nullable',
                'numeric',
                'min:0',
            ],
            'note' => ['nullable', 'string', 'max:1000'],
            'actor_type' => ['nullable', 'string', 'max:100'],
            'actor_id' => ['nullable', 'integer', 'min:1'],
            'receiver_name' => ['nullable', 'string', 'max:255'],
            'receiver_phone' => [
                Rule::requiredIf(fn () => $this->input('status') === 'picked_up'),
                'nullable',
                'string',
                'max:30',
            ],
            'receiver_address' => [
                Rule::requiredIf(fn () => $this->input('status') === 'picked_up'),
                'nullable',
                'string',
                'max:1000',
            ],
            'product_payment_method' => ['nullable', 'in:already_paid,rider_collects'],
            'cod_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
