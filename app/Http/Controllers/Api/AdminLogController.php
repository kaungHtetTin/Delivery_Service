<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $logs = AdminLog::query()
            ->when($request->string('action')->toString(), fn ($query, $action) => $query->where('action', $action))
            ->when($request->string('subject_type')->toString(), fn ($query, $type) => $query->where('subject_type', $type))
            ->latest()
            ->paginate($request->integer('per_page', 25));

        return response()->json($logs);
    }
}
