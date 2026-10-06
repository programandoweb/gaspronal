<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\AgentSettingController;
use App\Http\Controllers\Api\V1\AgentKnowledgeController;
use App\Http\Controllers\Api\V1\AgentAnalyticsController;
use App\Http\Controllers\Api\V1\AgentConversationController;
use App\Http\Controllers\Api\V1\InternalAgentKnowledgeController;
use App\Http\Controllers\Api\V1\InternalContentCreatorController;
use App\Http\Controllers\Api\V1\CatalogController;
use App\Http\Controllers\Api\V1\PostController;
use App\Http\Controllers\Api\V1\SeoRedirectController;
use App\Http\Controllers\Api\V1\DeploymentController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\HealthController;
use App\Http\Controllers\Api\V1\InternalAgentCommercialController;
use App\Http\Controllers\Api\V1\CommercialQuoteController;
use App\Http\Controllers\Api\V1\CommercialAppointmentController;
use App\Http\Controllers\Api\V1\JorgeResearchController;
use App\Http\Controllers\Api\V1\CommunicationProviderController;
use App\Http\Controllers\Api\V1\CommunicationConversationController;
use App\Http\Controllers\Api\V1\AiProviderController;
use App\Http\Controllers\Api\V1\UserAccessController;
use App\Http\Controllers\Api\V1\HeroSlideController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    Route::get('health', HealthController::class);
    Route::get('seo/redirects/resolve', [SeoRedirectController::class, 'resolve']);
    Route::get('catalog/public/items', [CatalogController::class, 'publicIndex']);
    Route::get('catalog/public/use-cases', [CatalogController::class, 'publicUseCases']);
    Route::get('catalog/public/items/{slug}', [CatalogController::class, 'publicShow']);
    Route::get('catalog/public/categories', [CatalogController::class, 'publicCategories']);
    Route::get('content/public/posts', [PostController::class, 'publicIndex']);
    Route::get('content/public/posts/{slug}', [PostController::class, 'publicShow']);
    Route::get('heroes/public', [HeroSlideController::class, 'publicIndex']);
    Route::get('heroes/media/{heroSlide}/{filename}', [HeroSlideController::class, 'media'])->where('filename', '[A-Za-z0-9._-]+');
    Route::get('catalog/items/{catalogItem}/media/{filename}', [CatalogController::class, 'media'])->where('filename', '[A-Za-z0-9._-]+');
    Route::get('content/posts/{post}/media/{filename}', [PostController::class, 'media'])->where('filename', '[A-Za-z0-9._-]+');
    Route::get('internal/agents/{agent}/credentials', [AgentSettingController::class, 'internalCredentials']);
    Route::post('internal/agents/{agent}/commercial-tools', [InternalAgentCommercialController::class, 'execute']);
    Route::post('internal/agents/{agent}/knowledge-tools', [InternalAgentKnowledgeController::class, 'execute']);
    Route::post('internal/agents/{agent}/interactions', [AgentAnalyticsController::class, 'internalLog']);
    Route::post('internal/content-creator/runs', [InternalContentCreatorController::class, 'storeRun']);
    Route::post('internal/content-creator/runs/{run}/sources', [InternalContentCreatorController::class, 'addSource']);
    Route::post('internal/content-creator/runs/{run}/artifacts', [InternalContentCreatorController::class, 'addArtifact']);
    Route::post('internal/content-creator/runs/{run}/complete', [InternalContentCreatorController::class, 'complete']);
    Route::post('internal/content-creator/runs/{run}/fail', [InternalContentCreatorController::class, 'fail']);
    Route::get('internal/communications/providers', [CommunicationProviderController::class, 'internalList']);
    Route::post('internal/communications/outbound-log', [CommunicationProviderController::class, 'internalLog']);
    Route::post('internal/communications/inbound', [CommunicationConversationController::class, 'internalReceive']);
    Route::post('internal/communications/conversations/{communicationConversation}/outbound', [CommunicationConversationController::class, 'internalRecordOutbound']);
    Route::get('internal/communications/conversations/{communicationConversation}/state', [CommunicationConversationController::class, 'internalState']);
    Route::patch('internal/communications/conversations/{communicationConversation}/status', [CommunicationConversationController::class, 'internalStatus']);

    Route::prefix('auth')->group(function (): void {
        Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
        Route::get('whatsapp/status', [AuthController::class, 'whatsappStatus'])->middleware('throttle:30,1');
        Route::post('whatsapp/request', [AuthController::class, 'requestWhatsAppPin'])->middleware('throttle:5,1');
        Route::post('whatsapp/verify', [AuthController::class, 'verifyWhatsAppPin'])->middleware('throttle:10,1');
        Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:password-reset');
        Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:password-reset');

        Route::middleware('auth:api')->group(function (): void {
            Route::get('me', [AuthController::class, 'me']);
            Route::post('refresh', [AuthController::class, 'refresh']);
            Route::post('logout', [AuthController::class, 'logout']);
        });
    });

    Route::middleware('auth:api')->group(function (): void {
        Route::get('dashboard/metrics', DashboardController::class)->middleware('permission:dashboard.view');
        Route::get('deployments', [DeploymentController::class, 'index'])->middleware('permission:deployments.view');
        Route::get('agents/dashboard', [AgentAnalyticsController::class, 'dashboard'])->middleware('permission:agents.view');
        Route::get('agents/{agent}/settings', [AgentSettingController::class, 'show'])->middleware('permission:agents.view');
        Route::get('agents/{agent}/sessions/latest', [AgentConversationController::class, 'latest'])->middleware('permission:agents.view');
        Route::post('agents/{agent}/sessions', [AgentConversationController::class, 'store'])->middleware('permission:agents.view');
        Route::post('agents/{agent}/sessions/{session}/messages', [AgentConversationController::class, 'storeMessage'])->middleware('permission:agents.view');
        Route::put('agents/{agent}/settings', [AgentSettingController::class, 'update'])->middleware('permission:agents.manage');
        Route::post('deployments', [DeploymentController::class, 'store'])->middleware(['permission:deployments.manage', 'throttle:2,1']);

        Route::get('ai/providers', [AiProviderController::class, 'providers'])->middleware('permission:ai.view');
        Route::post('ai/providers', [AiProviderController::class, 'storeProvider'])->middleware('permission:ai.manage');
        Route::put('ai/providers/{aiProvider}', [AiProviderController::class, 'updateProvider'])->middleware('permission:ai.manage');
        Route::delete('ai/providers/{aiProvider}', [AiProviderController::class, 'destroyProvider'])->middleware('permission:ai.manage');
        Route::post('ai/providers/{aiProvider}/test', [AiProviderController::class, 'testProvider'])->middleware('permission:ai.manage');

        Route::get('ai/agent-models', [AiProviderController::class, 'agentModels'])->middleware('permission:ai.view');
        Route::get('ai/models', [AiProviderController::class, 'models'])->middleware('permission:ai.view');
        Route::post('ai/models', [AiProviderController::class, 'storeModel'])->middleware('permission:ai.manage');
        Route::put('ai/models/{aiModel}', [AiProviderController::class, 'updateModel'])->middleware('permission:ai.manage');
        Route::delete('ai/models/{aiModel}', [AiProviderController::class, 'destroyModel'])->middleware('permission:ai.manage');

        Route::get('communications/providers', [CommunicationProviderController::class, 'index'])->middleware('permission:channels.view');
        Route::get('communications/providers/{communicationProvider}', [CommunicationProviderController::class, 'show'])->middleware('permission:channels.view');
        Route::post('communications/providers', [CommunicationProviderController::class, 'store'])->middleware('permission:channels.manage');
        Route::put('communications/providers/{communicationProvider}', [CommunicationProviderController::class, 'update'])->middleware('permission:channels.manage');
        Route::delete('communications/providers/{communicationProvider}', [CommunicationProviderController::class, 'destroy'])->middleware('permission:channels.manage');

        Route::get('agents/claudio/whatsapp-conversations', [CommunicationConversationController::class, 'index'])->middleware('permission:agents.view');
        Route::get('agents/claudio/whatsapp-conversations/{communicationConversation}', [CommunicationConversationController::class, 'show'])->middleware('permission:agents.view');
        Route::post('agents/claudio/whatsapp-conversations/{communicationConversation}/takeover', [CommunicationConversationController::class, 'takeover'])->middleware('permission:agents.manage');
        Route::post('agents/claudio/whatsapp-conversations/{communicationConversation}/resume', [CommunicationConversationController::class, 'resume'])->middleware('permission:agents.manage');
        Route::post('agents/claudio/whatsapp-conversations/{communicationConversation}/close', [CommunicationConversationController::class, 'close'])->middleware('permission:agents.manage');
        Route::post('agents/claudio/whatsapp-conversations/{communicationConversation}/messages', [CommunicationConversationController::class, 'reply'])->middleware('permission:agents.manage');

        Route::get('commercial/quotes', [CommercialQuoteController::class, 'index'])->middleware('permission:commercial.quotes.view');
        Route::get('commercial/quotes/{commercialQuote}', [CommercialQuoteController::class, 'show'])->middleware('permission:commercial.quotes.view');
        Route::put('commercial/quotes/{commercialQuote}', [CommercialQuoteController::class, 'update'])->middleware('permission:commercial.quotes.manage');
        Route::post('commercial/quotes/{commercialQuote}/approve', [CommercialQuoteController::class, 'approve'])->middleware('permission:commercial.quotes.manage');
        Route::get('commercial/appointments', [CommercialAppointmentController::class, 'index'])->middleware('permission:commercial.appointments.view');

        Route::get('agents/lucia/content-run', [InternalContentCreatorController::class, 'latestRun'])->middleware('permission:agents.view');
        Route::get('agents/jorge/research', [JorgeResearchController::class, 'show'])->middleware('permission:agents.view');
        Route::post('agents/jorge/research/play', [JorgeResearchController::class, 'play'])->middleware('permission:agents.manage');
        Route::post('agents/jorge/research/pause', [JorgeResearchController::class, 'pause'])->middleware('permission:agents.manage');
        Route::post('agents/jorge/research/stop', [JorgeResearchController::class, 'stop'])->middleware('permission:agents.manage');

        Route::get('agents/{agent}/knowledge', [AgentKnowledgeController::class, 'knowledge'])->middleware('permission:agents.view');
        Route::get('agents/{agent}/unanswered-questions', [AgentKnowledgeController::class, 'unanswered'])->middleware('permission:agents.view');
        Route::post('agents/{agent}/unanswered-questions/{question}/answer', [AgentKnowledgeController::class, 'answer'])->middleware('permission:agents.manage');
        Route::post('agents/{agent}/unanswered-questions/{question}/discard', [AgentKnowledgeController::class, 'discard'])->middleware('permission:agents.manage');

        Route::get('catalog/items', [CatalogController::class, 'index'])->middleware('permission:catalog.view');
        Route::get('catalog/items/{catalogItem}', [CatalogController::class, 'show'])->middleware('permission:catalog.view');
        Route::post('catalog/items', [CatalogController::class, 'store'])->middleware('permission:catalog.manage');
        Route::put('catalog/items/{catalogItem}', [CatalogController::class, 'update'])->middleware('permission:catalog.manage');
        Route::delete('catalog/items/{catalogItem}', [CatalogController::class, 'destroy'])->middleware('permission:catalog.manage');
        Route::post('catalog/items/{catalogItem}/gallery', [CatalogController::class, 'uploadGallery'])->middleware('permission:catalog.manage');
        Route::put('catalog/items/{catalogItem}/gallery/primary', [CatalogController::class, 'setPrimaryGalleryImage'])->middleware('permission:catalog.manage');
        Route::delete('catalog/items/{catalogItem}/gallery', [CatalogController::class, 'destroyGalleryImage'])->middleware('permission:catalog.manage');
        Route::get('catalog/categories', [CatalogController::class, 'categories'])->middleware('permission:catalog.view');
        Route::get('catalog/categories/{catalogCategory}', [CatalogController::class, 'showCategory'])->middleware('permission:catalog.view');
        Route::post('catalog/categories', [CatalogController::class, 'storeCategory'])->middleware('permission:catalog.manage');
        Route::put('catalog/categories/{catalogCategory}', [CatalogController::class, 'updateCategory'])->middleware('permission:catalog.manage');
        Route::delete('catalog/categories/{catalogCategory}', [CatalogController::class, 'destroyCategory'])->middleware('permission:catalog.manage');

        Route::get('heroes', [HeroSlideController::class, 'index'])->middleware('permission:heroes.view');
        Route::post('heroes', [HeroSlideController::class, 'store'])->middleware('permission:heroes.manage');
        Route::put('heroes/{heroSlide}', [HeroSlideController::class, 'update'])->middleware('permission:heroes.manage');
        Route::delete('heroes/{heroSlide}', [HeroSlideController::class, 'destroy'])->middleware('permission:heroes.manage');
        Route::post('heroes/{heroSlide}/image', [HeroSlideController::class, 'uploadImage'])->middleware('permission:heroes.manage');

        Route::get('content/posts', [PostController::class, 'index'])->middleware('permission:content.view');
        Route::get('content/posts/{post}', [PostController::class, 'show'])->middleware('permission:content.view');
        Route::post('content/posts', [PostController::class, 'store'])->middleware('permission:content.manage');
        Route::put('content/posts/{post}', [PostController::class, 'update'])->middleware('permission:content.manage');
        Route::delete('content/posts/{post}', [PostController::class, 'destroy'])->middleware('permission:content.manage');
        Route::post('content/posts/{post}/gallery', [PostController::class, 'uploadGallery'])->middleware('permission:content.manage');
        Route::put('content/posts/{post}/gallery/primary', [PostController::class, 'setPrimaryGalleryImage'])->middleware('permission:content.manage');
        Route::delete('content/posts/{post}/gallery', [PostController::class, 'destroyGalleryImage'])->middleware('permission:content.manage');
        Route::get('content/post-categories', [PostController::class, 'categories'])->middleware('permission:content.view');
        Route::post('content/post-categories', [PostController::class, 'storeCategory'])->middleware('permission:content.manage');
        Route::put('content/post-categories/{postCategory}', [PostController::class, 'updateCategory'])->middleware('permission:content.manage');


        Route::get('security/users', [UserAccessController::class, 'users'])->middleware('permission:security.users.view');
        Route::post('security/users', [UserAccessController::class, 'storeUser'])->middleware('permission:security.users.manage');
        Route::put('security/users/{user}', [UserAccessController::class, 'updateUser'])->middleware('permission:security.users.manage');
        Route::post('security/users/{user}/invite', [UserAccessController::class, 'inviteUser'])->middleware(['permission:security.users.manage', 'throttle:6,1']);
        Route::post('security/users/{user}/impersonate', [UserAccessController::class, 'impersonateUser'])->middleware('throttle:10,1');
        Route::delete('security/users/{user}', [UserAccessController::class, 'destroyUser'])->middleware('permission:security.users.manage');
        Route::get('security/roles', [UserAccessController::class, 'roles'])->middleware('permission:security.roles.view');
        Route::post('security/roles', [UserAccessController::class, 'storeRole'])->middleware('permission:security.roles.manage');
        Route::put('security/roles/{role}', [UserAccessController::class, 'updateRole'])->middleware('permission:security.roles.manage');
        Route::delete('security/roles/{role}', [UserAccessController::class, 'destroyRole'])->middleware('permission:security.roles.manage');
        Route::get('security/permissions', [UserAccessController::class, 'permissions'])->middleware('permission:security.roles.view');

        Route::get('seo/redirects', [SeoRedirectController::class, 'index'])->middleware('permission:seo.view');
        Route::get('seo/redirects/{seoRedirect}', [SeoRedirectController::class, 'show'])->middleware('permission:seo.view');
        Route::post('seo/redirects', [SeoRedirectController::class, 'store'])->middleware('permission:seo.manage');
        Route::put('seo/redirects/{seoRedirect}', [SeoRedirectController::class, 'update'])->middleware('permission:seo.manage');
        Route::delete('seo/redirects/{seoRedirect}', [SeoRedirectController::class, 'destroy'])->middleware('permission:seo.manage');
    });
});
