<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminLog;
use App\Models\SystemSetting;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SystemSettingController extends Controller
{
    private const PUBLIC_KEYS = [
        'app_name',
        'brand_color',
        'default_theme',
        'contact_email',
        'contact_phone',
    ];

    public function publicIndex(): JsonResponse
    {
        $settings = SystemSetting::query()
            ->whereIn('key', self::PUBLIC_KEYS)
            ->orderBy('key')
            ->get();

        return response()->json(['data' => $settings]);
    }

    public function index(Request $request): JsonResponse
    {
        $settings = SystemSetting::query()
            ->when($request->string('group')->toString(), fn ($query, $group) => $query->where('group', $group))
            ->orderBy('group')
            ->orderBy('key')
            ->get();

        return response()->json(['data' => $settings]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());
        $setting = SystemSetting::create($validated);
        $this->log($request, 'setting_created', $setting, $validated);

        return response()->json($setting, 201);
    }

    public function show(SystemSetting $systemSetting): JsonResponse
    {
        return response()->json($systemSetting);
    }

    public function update(Request $request, SystemSetting $systemSetting): JsonResponse
    {
        $validated = $request->validate($this->rules($systemSetting));
        $previous = $systemSetting->only(array_keys($validated));
        $systemSetting->update($validated);
        $this->log($request, 'setting_updated', $systemSetting, ['previous' => $previous, 'current' => $validated]);

        return response()->json($systemSetting->fresh());
    }

    public function destroy(Request $request, SystemSetting $systemSetting): JsonResponse
    {
        $snapshot = $systemSetting->only(['key', 'group', 'value']);
        $id = $systemSetting->id;
        $systemSetting->delete();

        AdminLog::create([
            'action' => 'setting_deleted',
            'subject_type' => SystemSetting::class,
            'subject_id' => $id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $snapshot,
        ]);

        return response()->json(['message' => 'Setting deleted.']);
    }

    private function rules(?SystemSetting $setting = null): array
    {
        return [
            'key' => [$setting ? 'sometimes' : 'required', 'string', 'max:100', Rule::unique('system_settings', 'key')->ignore($setting)],
            'value' => ['nullable'],
            'group' => ['nullable', 'string', 'max:100'],
            'description' => ['nullable', 'string', 'max:1000'],
        ];
    }

    private function log(Request $request, string $action, SystemSetting $setting, array $metadata): void
    {
        AdminLog::create([
            'action' => $action,
            'subject_type' => SystemSetting::class,
            'subject_id' => $setting->id,
            'actor_type' => 'office_admin',
            'actor_id' => $request->user()?->id,
            'metadata' => $metadata,
        ]);
    }
}
