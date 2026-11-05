<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\InstagramFeedService;
use Illuminate\Http\JsonResponse;

class InstagramFeedController extends Controller
{
    public function index(InstagramFeedService $service): JsonResponse
    {
        return response()->json(['data' => $service->latestPosts()]);
    }
}
