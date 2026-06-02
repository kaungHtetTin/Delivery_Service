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
            'note' => ['nullable', 'string', 'max:1000'],
            'actor_type' => ['nullable', 'string', 'max:100'],
            'actor_id' => ['nullable', 'integer', 'min:1'],
        ];
    }
}
