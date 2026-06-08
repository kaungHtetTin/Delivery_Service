<?php

namespace App\Notifications;

use App\Models\DeliveryOrder;
use Illuminate\Bus\Queueable;
use Illuminate\Notifications\Notification;

class OrderActivityNotification extends Notification
{
    use Queueable;

    public function __construct(
        private DeliveryOrder $order,
        private string $kind,
        private string $title,
        private string $body,
        private array $meta = []
    ) {
    }

    public function via($notifiable): array
    {
        return ['database'];
    }

    public function toArray($notifiable): array
    {
        return [
            'kind' => $this->kind,
            'title' => $this->title,
            'body' => $this->body,
            'order_id' => $this->order->id,
            'order_code' => $this->order->code,
            'status' => $this->order->status,
        ] + $this->meta;
    }
}
