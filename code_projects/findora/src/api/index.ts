// Findora API Worker Entry Point
// Routes all /api/* requests to appropriate handlers
import { Env } from '../db/schema';
import { jsonError } from '../lib/response';
import { ErrorCodes } from '../lib/errors';
import { listProducts, getProduct, createProduct, updateProduct, toggleProductStatus, updateProductTags, batchUpdateProducts, importProducts, getTrending } from './products';
import { listLists, getList, createList } from './lists';
import { submitPriceCheck, submitBatchPriceCheck, getPriceHistory, listPriceChanges } from './price_check';
import { getCategories, getCategorySubcategories } from './categories';
import { subscribe, unsubscribe, updatePreferences } from './subscribe';
import { addFavorite, removeFavorite, listFavorites, addFavoriteList, removeFavoriteList, listFavoriteLists } from './favorites';
import { recordClick } from './clicks';
import { getRecommendations } from './recommendations';
import { createTag, listTags, updateTag, deleteTag, getTagStats, updateTagFeaturedProducts } from './tags';
import { getAnalyticsOverview, getAnalyticsUV, getAnalyticsCTR, getAnalyticsConversion, getAnalyticsCategories, getAnalyticsLists, getAnalyticsTrends } from './analytics';
import { listSubscribers, exportSubscribers, getSubscriberSegments } from './admin/subscribers';
import { recordConversion, listConversions, getConversionStats } from './conversions';
import { sendSubscriptionConfirmation, sendWeeklyNewsletter, sendUnsubscriptionConfirmation, sendReengagementEmail, getEmailLogs } from './email';
import { getProductBehaviorScore, getBehavioralRecommendations } from './behavior';
import { explainProduct, explainBatch, explainComparison, explainScenarios, getExplainCacheStats } from './explain';
import { aiSelectionAssistance, aiContentGeneration, aiSocialCopy, aiAnalyticsInsights, aiProductCompletion, getAIStatus } from './ai_content';
import {
  createAIReviewRecord, submitContentForReview, reviewContent, reviewHighRiskContent,
  reviewTone, requestContentRevision, getReviewRecordById, listAIReviewRecords,
  getPendingCounts, validateContent
} from './ai_review';
import {
  getSupportedLocales, getTranslations, getContentTranslation,
  createTranslationKey, listTranslationKeys, saveTranslation,
  saveContentTranslation, queueTranslationSync, getSyncQueue, updateSyncItem,
  listLocales, addLocale, updateLocale
} from './i18n';
import {
  listMembershipTiers, getMyMembership, checkEntitlement,
  adminListTiers, createTier, updateTier, createSubscription,
  listSubscriptions, cancelSubscription, renewSubscription,
  getSubscription, markExclusiveContent, listExclusiveContent,
  listEntitlements, getMembershipStats
} from './membership';
import {
  createTopic, listTopics, getTopic, updateTopicStatus,
  addTopicProducts, publishContent, getPublishSchedule,
  getProductionStats
} from './admin/content';
import { register, login, logout, getCurrentUser, changePassword, refreshSession } from './auth';
import {
  createEnterprise, listEnterprises, getEnterprise, updateEnterprise, deleteEnterprise,
  listEnterpriseMembers, addEnterpriseMember, updateEnterpriseMember, removeEnterpriseMember, getEnterpriseMember
} from './enterprise';
import {
  createRecord, listRecords, getRecord, updateRecord, deleteRecord,
  updateRecordStatus, reviewRecord, getExpiringRecords
} from './record';
import {
  listAuditLogs, listMyAuditLogs, getAuditLog, getAuditStats, exportAuditLogs
} from './audit';
import {
  getProfile, updateProfile, updateAvatar, searchUsers, getUserById,
  listSessions, revokeSession, revokeAllSessions, updateUserStatus
} from './user';

function isAdmin(request: Request, env: Env): boolean {
  const adminKey = request.headers.get('X-Admin-Key');
  if (!adminKey || !env.ADMIN_KEY) return false;
  return adminKey === env.ADMIN_KEY;
}

async function handleRequest(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  // API prefix required
  if (!pathname.startsWith('/api/')) {
    // If not an API request, let Cloudflare Assets handle it
    return env.ASSETS.fetch(request);
  }

  const path = pathname.slice(4); // Remove '/api'
  const segments = path.split('/').filter(Boolean);

  // Health check
  if (path === 'health' || path === '') {
    return new Response(JSON.stringify({ ok: true, message: 'Findora API running' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    // === Public Endpoints ===

    // GET /api/trending - F-001-05
    if (request.method === 'GET' && segments[0] === 'trending') {
      return getTrending(env, request);
    }

    // GET /api/products - F-040-01
    if (request.method === 'GET' && segments[0] === 'products' && !segments[1]) {
      return listProducts(env, request);
    }

    // GET /api/products/:id - F-040-02
    if (request.method === 'GET' && segments[0] === 'products' && segments[1]) {
      return getProduct(env, request, segments[1]);
    }

    // GET /api/lists - F-040-03
    if (request.method === 'GET' && segments[0] === 'lists' && !segments[1]) {
      return listLists(env);
    }

    // GET /api/lists/:id - F-040-04
    if (request.method === 'GET' && segments[0] === 'lists' && segments[1]) {
      return getList(env, segments[1]);
    }

    // GET /api/categories/:category/subcategories - F-002-03
    if (request.method === 'GET' && segments[0] === 'categories' && segments[1] && segments[2] === 'subcategories') {
      return getCategorySubcategories(env, segments[1]);
    }

    // GET /api/categories - F-040-05
    if (request.method === 'GET' && segments[0] === 'categories' && !segments[1]) {
      return getCategories(env);
    }

    // === User Endpoints (email/anonymous_id based) ===

    // POST /api/subscribe - F-040-06
    if (request.method === 'POST' && segments[0] === 'subscribe') {
      return subscribe(env, request);
    }

    // DELETE /api/subscribe - F-040-07
    if (request.method === 'DELETE' && segments[0] === 'subscribe') {
      return unsubscribe(env, request);
    }

    // PATCH /api/subscribe/preferences - F-040-08
    if (request.method === 'PATCH' && segments[0] === 'subscribe' && segments[1] === 'preferences') {
      return updatePreferences(env, request);
    }

    // POST /api/favorites - F-040-09
    if (request.method === 'POST' && segments[0] === 'favorites') {
      return addFavorite(env, request);
    }

    // GET /api/favorites - F-040-11
    if (request.method === 'GET' && segments[0] === 'favorites' && !segments[1]) {
      return listFavorites(env, request);
    }

    // GET /api/favorites/lists - F-004-06
    if (request.method === 'GET' && segments[0] === 'favorites' && segments[1] === 'lists') {
      return listFavoriteLists(env, request);
    }

    // POST /api/favorites/lists/:list_id - F-004-06
    if (request.method === 'POST' && segments[0] === 'favorites' && segments[1] === 'lists' && segments[2]) {
      return addFavoriteList(env, request, segments[2]);
    }

    // DELETE /api/favorites/lists/:list_id - F-004-06
    if (request.method === 'DELETE' && segments[0] === 'favorites' && segments[1] === 'lists' && segments[2]) {
      return removeFavoriteList(env, request, segments[2]);
    }

    // DELETE /api/favorites/:product_id - F-040-10
    if (request.method === 'DELETE' && segments[0] === 'favorites' && segments[1]) {
      return removeFavorite(env, request, segments[1]);
    }

    // POST /api/clicks - F-040-12
    if (request.method === 'POST' && segments[0] === 'clicks') {
      return recordClick(env, request);
    }

    // GET /api/recommendations/behavioral - F-015 (behavior-enhanced recommendations, user-facing)
    if (request.method === 'GET' && segments[0] === 'recommendations' && segments[1] === 'behavioral') {
      return getBehavioralRecommendations(env, request);
    }

    // GET /api/recommendations - F-040-13
    if (request.method === 'GET' && segments[0] === 'recommendations' && !segments[1]) {
      return getRecommendations(env, request);
    }

    // POST /api/conversions/callback - F-012-05
    if (request.method === 'POST' && segments[0] === 'conversions' && segments[1] === 'callback') {
      return recordConversion(env, request);
    }

    // POST /api/email/send-confirmation - F-013-07 (public endpoint for subscription confirmation)
    if (request.method === 'POST' && segments[0] === 'email' && segments[1] === 'send-confirmation') {
      return sendSubscriptionConfirmation(env, request);
    }

    // GET /api/explain/:product_id/comparison - F-016-02
    if (request.method === 'GET' && segments[0] === 'explain' && segments[1] && segments[2] === 'comparison') {
      return explainComparison(env, request, segments[1]);
    }

    // GET /api/explain/:product_id/scenarios - F-016-03
    if (request.method === 'GET' && segments[0] === 'explain' && segments[1] && segments[2] === 'scenarios') {
      return explainScenarios(env, request, segments[1]);
    }

    // GET /api/explain/:product_id - F-016-01 (get explanation for a product)
    if (request.method === 'GET' && segments[0] === 'explain' && segments[1] && !segments[2]) {
      return explainProduct(env, request, segments[1]);
    }

    // POST /api/explain/batch - F-016-01 (batch explanations)
    if (request.method === 'POST' && segments[0] === 'explain' && segments[1] === 'batch') {
      return explainBatch(env, request);
    }

    // === Public i18n Routes (F-022) - moved outside admin block ===

    // GET /api/i18n/locales - Get supported locales
    if (request.method === 'GET' && segments[0] === 'i18n' && segments[1] === 'locales' && !segments[2]) {
      return getSupportedLocales(env);
    }

    // GET /api/i18n/translations/:locale - Get translations for a locale
    if (request.method === 'GET' && segments[0] === 'i18n' && segments[1] === 'translations' && segments[2]) {
      return getTranslations(env, request, segments[2]);
    }

    // GET /api/i18n/content/:type/:id/:locale/:field - Get translated content
    if (request.method === 'GET' && segments[0] === 'i18n' && segments[1] === 'content' && segments[2] && segments[3] && segments[4] && segments[5]) {
      return getContentTranslation(env, segments[2], segments[3], segments[4], segments[5]);
    }

    // === Public Membership Routes (F-023) - moved outside admin block ===

    // GET /api/membership/tiers - List membership tiers
    if (request.method === 'GET' && segments[0] === 'membership' && segments[1] === 'tiers') {
      return listMembershipTiers(env);
    }

    // GET /api/membership/my - Get current user's membership
    if (request.method === 'GET' && segments[0] === 'membership' && segments[1] === 'my') {
      return getMyMembership(env, request);
    }

    // POST /api/membership/check - Check feature entitlement
    if (request.method === 'POST' && segments[0] === 'membership' && segments[1] === 'check') {
      return checkEntitlement(env, request);
    }

    // === Admin Endpoints (require admin auth) ===

    if (segments[0] === 'admin') {
      if (!isAdmin(request, env)) {
        return new Response(JSON.stringify(jsonError(ErrorCodes.INVALID_PARAMS, 'Admin authorization required')), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // POST /api/admin/products - F-040-14
      if (request.method === 'POST' && segments[1] === 'products' && !segments[2]) {
        return createProduct(env, request);
      }

      // PUT /api/admin/products/:id - F-040-15
      if (request.method === 'PUT' && segments[1] === 'products' && segments[2]) {
        return updateProduct(env, request, segments[2]);
      }

      // PATCH /api/admin/products/:id/status - F-040-16
      if (request.method === 'PATCH' && segments[1] === 'products' && segments[2] && segments[3] === 'status') {
        return toggleProductStatus(env, request, segments[2]);
      }

      // POST /api/admin/tags - F-040-17
      if (request.method === 'POST' && segments[1] === 'tags') {
        return createTag(env, request);
      }

      // POST /api/admin/lists - F-040-18
      if (request.method === 'POST' && segments[1] === 'lists') {
        return createList(env, request);
      }

      // GET /api/admin/analytics/overview - F-017
      if (request.method === 'GET' && segments[1] === 'analytics' && segments[2] === 'overview') {
        return getAnalyticsOverview(env);
      }

      // GET /api/admin/analytics/uv - F-017
      if (request.method === 'GET' && segments[1] === 'analytics' && segments[2] === 'uv') {
        return getAnalyticsUV(env, request);
      }

      // GET /api/admin/analytics/ctr - F-017
      if (request.method === 'GET' && segments[1] === 'analytics' && segments[2] === 'ctr') {
        return getAnalyticsCTR(env);
      }

      // GET /api/admin/analytics/conversion - F-017
      if (request.method === 'GET' && segments[1] === 'analytics' && segments[2] === 'conversion') {
        return getAnalyticsConversion(env);
      }

      // GET /api/admin/analytics/categories - F-017
      if (request.method === 'GET' && segments[1] === 'analytics' && segments[2] === 'categories') {
        return getAnalyticsCategories(env);
      }

      // GET /api/admin/analytics/lists - F-017
      if (request.method === 'GET' && segments[1] === 'analytics' && segments[2] === 'lists') {
        return getAnalyticsLists(env);
      }

      // GET /api/admin/analytics/trends - F-017
      if (request.method === 'GET' && segments[1] === 'analytics' && segments[2] === 'trends') {
        return getAnalyticsTrends(env, request);
      }

      // GET /api/admin/subscribers - F-013-08
      if (request.method === 'GET' && segments[1] === 'subscribers' && !segments[2]) {
        return listSubscribers(env, request);
      }

      // GET /api/admin/subscribers/export - F-013-09
      if (request.method === 'GET' && segments[1] === 'subscribers' && segments[2] === 'export') {
        return exportSubscribers(env, request);
      }

      // GET /api/admin/subscribers/segments - F-013-06
      if (request.method === 'GET' && segments[1] === 'subscribers' && segments[2] === 'segments') {
        return getSubscriberSegments(env, request);
      }

      // PATCH /api/admin/products/:id/tags - F-011-02
      if (request.method === 'PATCH' && segments[1] === 'products' && segments[2] && segments[3] === 'tags') {
        return updateProductTags(env, request, segments[2]);
      }

      // POST /api/admin/products/batch - F-010-04
      if (request.method === 'POST' && segments[1] === 'products' && segments[2] === 'batch') {
        return batchUpdateProducts(env, request);
      }

      // POST /api/admin/products/import - F-010-01
      if (request.method === 'POST' && segments[1] === 'products' && segments[2] === 'import') {
        return importProducts(env, request);
      }

      // GET /api/admin/tags - F-011-01 list
      if (request.method === 'GET' && segments[1] === 'tags' && !segments[2]) {
        return listTags(env, request);
      }

      // PUT /api/admin/tags/:id - F-011-01 update
      if (request.method === 'PUT' && segments[1] === 'tags' && segments[2]) {
        return updateTag(env, request, segments[2]);
      }

      // PATCH /api/admin/tags/:id/featured - F-040-17d
      if (request.method === 'PATCH' && segments[1] === 'tags' && segments[2] && segments[3] === 'featured') {
        return updateTagFeaturedProducts(env, request, segments[2]);
      }

      // DELETE /api/admin/tags/:id - F-011-01 delete
      if (request.method === 'DELETE' && segments[1] === 'tags' && segments[2]) {
        return deleteTag(env, request, segments[2]);
      }

      // GET /api/admin/tags/stats - F-011-03
      if (request.method === 'GET' && segments[1] === 'tags' && segments[2] === 'stats') {
        return getTagStats(env);
      }

      // GET /api/admin/conversions - F-012-05
      if (request.method === 'GET' && segments[1] === 'conversions' && !segments[2]) {
        return listConversions(env, request);
      }

      // GET /api/admin/conversions/stats - F-012-05
      if (request.method === 'GET' && segments[1] === 'conversions' && segments[2] === 'stats') {
        return getConversionStats(env, request);
      }

      // POST /api/email/send-weekly - F-013-07
      if (request.method === 'POST' && segments[1] === 'email' && segments[2] === 'send-weekly') {
        return sendWeeklyNewsletter(env, request);
      }

      // POST /api/email/send-unsubscription-confirmation - F-013-07
      if (request.method === 'POST' && segments[1] === 'email' && segments[2] === 'send-unsubscription-confirmation') {
        return sendUnsubscriptionConfirmation(env, request);
      }

      // POST /api/email/send-reengagement - F-013-07
      if (request.method === 'POST' && segments[1] === 'email' && segments[2] === 'send-reengagement') {
        return sendReengagementEmail(env, request);
      }

      // GET /api/admin/email/logs - F-013-07
      if (request.method === 'GET' && segments[1] === 'email' && segments[2] === 'logs') {
        return getEmailLogs(env, request);
      }

      // GET /api/admin/recommendations/behavior - F-015-01 (behavior score debug)
      if (request.method === 'GET' && segments[1] === 'recommendations' && segments[2] === 'behavior') {
        return getProductBehaviorScore(env, request);
      }

      // GET /api/admin/explain/cache/stats - F-016-04
      if (request.method === 'GET' && segments[1] === 'explain' && segments[2] === 'cache' && segments[3] === 'stats') {
        return getExplainCacheStats(env);
      }

      // === AI Content Generation Routes (F-020) ===

      // GET /api/admin/ai/status - Check AI configuration status
      if (request.method === 'GET' && segments[1] === 'ai' && segments[2] === 'status') {
        return getAIStatus(env);
      }

      // POST /api/admin/ai/selection-assistance - F-020-01
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'selection-assistance') {
        return aiSelectionAssistance(env, request);
      }

      // POST /api/admin/ai/content-generation - F-020-02
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'content-generation') {
        return aiContentGeneration(env, request);
      }

      // POST /api/admin/ai/social-copy - F-020-03
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'social-copy') {
        return aiSocialCopy(env, request);
      }

      // POST /api/admin/ai/analytics-insights - F-020-05
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'analytics-insights') {
        return aiAnalyticsInsights(env, request);
      }

      // POST /api/admin/ai/product-completion - F-020-06
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'product-completion') {
        return aiProductCompletion(env, request);
      }

      // === AI Review Workflow Routes (F-021) ===

      // POST /api/admin/ai/review/create - Create review record
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'review' && segments[3] === 'create') {
        return createAIReviewRecord(env, request);
      }

      // GET /api/admin/ai/review - List review records
      if (request.method === 'GET' && segments[1] === 'ai' && segments[2] === 'review' && !segments[3]) {
        return listAIReviewRecords(env, request);
      }

      // GET /api/admin/ai/review/pending-counts - Get pending review counts
      if (request.method === 'GET' && segments[1] === 'ai' && segments[2] === 'review' && segments[3] === 'pending-counts') {
        return getPendingCounts(env);
      }

      // POST /api/admin/ai/review/validate - Validate content
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'review' && segments[3] === 'validate') {
        return validateContent(env, request);
      }

      // GET /api/admin/ai/review/:id - Get specific review record
      if (request.method === 'GET' && segments[1] === 'ai' && segments[2] === 'review' && segments[3]) {
        return getReviewRecordById(env, request, segments[3]);
      }

      // POST /api/admin/ai/review/:id/submit - Submit for review
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'review' && segments[3] && segments[4] === 'submit') {
        return submitContentForReview(env, request, segments[3]);
      }

      // POST /api/admin/ai/review/:id/review - First review
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'review' && segments[3] && segments[4] === 'review') {
        return reviewContent(env, request, segments[3]);
      }

      // POST /api/admin/ai/review/:id/high-risk-review - High-risk second review
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'review' && segments[3] && segments[4] === 'high-risk-review') {
        return reviewHighRiskContent(env, request, segments[3]);
      }

      // POST /api/admin/ai/review/:id/tone-review - Tone review
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'review' && segments[3] && segments[4] === 'tone-review') {
        return reviewTone(env, request, segments[3]);
      }

      // POST /api/admin/ai/review/:id/revision - Request revision
      if (request.method === 'POST' && segments[1] === 'ai' && segments[2] === 'review' && segments[3] && segments[4] === 'revision') {
        return requestContentRevision(env, request, segments[3]);
      }

      // === Price Check Endpoints (F-010-05) ===

      // POST /api/admin/price-check - Submit price check result from external service
      if (request.method === 'POST' && segments[1] === 'price-check' && !segments[2]) {
        return submitPriceCheck(env, request);
      }

      // POST /api/admin/price-check/batch - Batch price check submission
      if (request.method === 'POST' && segments[1] === 'price-check' && segments[2] === 'batch') {
        return submitBatchPriceCheck(env, request);
      }

      // GET /api/admin/price-check - List recent price changes across products
      if (request.method === 'GET' && segments[1] === 'price-check' && !segments[2]) {
        return listPriceChanges(env, request);
      }

      // GET /api/admin/price-check/:product_id - Get price history for specific product
      if (request.method === 'GET' && segments[1] === 'price-check' && segments[2]) {
        return getPriceHistory(env, request, segments[2]);
      }

      // === Admin i18n Routes (F-022) ===

      // GET /api/admin/i18n/locales - List all locales
      if (request.method === 'GET' && segments[1] === 'i18n' && segments[2] === 'locales' && !segments[3]) {
        return listLocales(env);
      }

      // POST /api/admin/i18n/locales - Add new locale
      if (request.method === 'POST' && segments[1] === 'i18n' && segments[2] === 'locales') {
        return addLocale(env, request);
      }

      // PUT /api/admin/i18n/locales/:code - Update locale
      if (request.method === 'PUT' && segments[1] === 'i18n' && segments[2] === 'locales' && segments[3]) {
        return updateLocale(env, request, segments[3]);
      }

      // GET /api/admin/i18n/keys - List translation keys
      if (request.method === 'GET' && segments[1] === 'i18n' && segments[2] === 'keys') {
        return listTranslationKeys(env, request);
      }

      // POST /api/admin/i18n/keys - Create translation key
      if (request.method === 'POST' && segments[1] === 'i18n' && segments[2] === 'keys') {
        return createTranslationKey(env, request);
      }

      // POST /api/admin/i18n/translations - Save translation
      if (request.method === 'POST' && segments[1] === 'i18n' && segments[2] === 'translations') {
        return saveTranslation(env, request);
      }

      // POST /api/admin/i18n/content - Save content translation
      if (request.method === 'POST' && segments[1] === 'i18n' && segments[2] === 'content') {
        return saveContentTranslation(env, request);
      }

      // GET /api/admin/i18n/sync - Get sync queue
      if (request.method === 'GET' && segments[1] === 'i18n' && segments[2] === 'sync') {
        return getSyncQueue(env, request);
      }

      // POST /api/admin/i18n/sync - Queue content for re-translation
      if (request.method === 'POST' && segments[1] === 'i18n' && segments[2] === 'sync') {
        return queueTranslationSync(env, request);
      }

      // PUT /api/admin/i18n/sync/:id - Update sync item status
      if (request.method === 'PUT' && segments[1] === 'i18n' && segments[2] === 'sync' && segments[3]) {
        return updateSyncItem(env, request, segments[3]);
      }

      // === Admin Membership Routes (F-023) ===

      // GET /api/admin/membership/tiers - List all tiers
      if (request.method === 'GET' && segments[1] === 'membership' && segments[2] === 'tiers' && !segments[3]) {
        return adminListTiers(env);
      }

      // POST /api/admin/membership/tiers - Create tier
      if (request.method === 'POST' && segments[1] === 'membership' && segments[2] === 'tiers') {
        return createTier(env, request);
      }

      // PUT /api/admin/membership/tiers/:code - Update tier
      if (request.method === 'PUT' && segments[1] === 'membership' && segments[2] === 'tiers' && segments[3]) {
        return updateTier(env, request, segments[3]);
      }

      // POST /api/admin/membership/subscribe - Create subscription
      if (request.method === 'POST' && segments[1] === 'membership' && segments[2] === 'subscribe') {
        return createSubscription(env, request);
      }

      // GET /api/admin/membership/subscriptions - List subscriptions
      if (request.method === 'GET' && segments[1] === 'membership' && segments[2] === 'subscriptions' && !segments[3]) {
        return listSubscriptions(env, request);
      }

      // GET /api/admin/membership/subscriptions/:id - Get subscription details
      if (request.method === 'GET' && segments[1] === 'membership' && segments[2] === 'subscriptions' && segments[3]) {
        return getSubscription(env, request, segments[3]);
      }

      // POST /api/admin/membership/subscriptions/:id/cancel - Cancel subscription
      if (request.method === 'POST' && segments[1] === 'membership' && segments[2] === 'subscriptions' && segments[3] && segments[4] === 'cancel') {
        return cancelSubscription(env, request, segments[3]);
      }

      // POST /api/admin/membership/subscriptions/:id/renew - Renew subscription
      if (request.method === 'POST' && segments[1] === 'membership' && segments[2] === 'subscriptions' && segments[3] && segments[4] === 'renew') {
        return renewSubscription(env, request, segments[3]);
      }

      // GET /api/admin/membership/entitlements - List entitlements
      if (request.method === 'GET' && segments[1] === 'membership' && segments[2] === 'entitlements') {
        return listEntitlements(env, request);
      }

      // POST /api/admin/membership/exclusive-content - Mark content as exclusive
      if (request.method === 'POST' && segments[1] === 'membership' && segments[2] === 'exclusive-content') {
        return markExclusiveContent(env, request);
      }

      // GET /api/admin/membership/exclusive-content - List exclusive content
      if (request.method === 'GET' && segments[1] === 'membership' && segments[2] === 'exclusive-content') {
        return listExclusiveContent(env, request);
      }

      // GET /api/admin/membership/stats - Membership statistics
      if (request.method === 'GET' && segments[1] === 'membership' && segments[2] === 'stats') {
        return getMembershipStats(env);
      }

      // === Content Management Routes (F-030) ===

      // POST /api/admin/content/topics - Create topic
      if (request.method === 'POST' && segments[1] === 'content' && segments[2] === 'topics' && !segments[3]) {
        return createTopic(env, request);
      }

      // GET /api/admin/content/topics - List topics
      if (request.method === 'GET' && segments[1] === 'content' && segments[2] === 'topics' && !segments[3]) {
        return listTopics(env, request);
      }

      // GET /api/admin/content/topics/:id - Get topic details
      if (request.method === 'GET' && segments[1] === 'content' && segments[2] === 'topics' && segments[3]) {
        return getTopic(env, request, segments[3]);
      }

      // PATCH /api/admin/content/topics/:id - Update topic status
      if (request.method === 'PATCH' && segments[1] === 'content' && segments[2] === 'topics' && segments[3]) {
        return updateTopicStatus(env, request, segments[3]);
      }

      // POST /api/admin/content/topics/:id/products - Add products to topic
      if (request.method === 'POST' && segments[1] === 'content' && segments[2] === 'topics' && segments[3] && segments[4] === 'products') {
        return addTopicProducts(env, request, segments[3]);
      }

      // POST /api/admin/content/publish - Publish content
      if (request.method === 'POST' && segments[1] === 'content' && segments[2] === 'publish' && !segments[3]) {
        return publishContent(env, request);
      }

      // GET /api/admin/content/publish/schedule - Get publish schedule
      if (request.method === 'GET' && segments[1] === 'content' && segments[2] === 'publish' && segments[3] === 'schedule') {
        return getPublishSchedule(env, request);
      }

      // GET /api/admin/content/production/stats - Get production statistics
      if (request.method === 'GET' && segments[1] === 'content' && segments[2] === 'production' && segments[3] === 'stats') {
        return getProductionStats(env, request);
      }
    }

    // === EMS Auth Routes ===

    // POST /api/auth/register
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'register') {
      return register(env, request);
    }

    // POST /api/auth/login
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'login') {
      return login(env, request);
    }

    // POST /api/auth/logout
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'logout') {
      return logout(env, request);
    }

    // GET /api/auth/me
    if (request.method === 'GET' && segments[0] === 'auth' && segments[1] === 'me') {
      return getCurrentUser(env, request);
    }

    // POST /api/auth/change-password
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'change-password') {
      return changePassword(env, request);
    }

    // POST /api/auth/refresh
    if (request.method === 'POST' && segments[0] === 'auth' && segments[1] === 'refresh') {
      return refreshSession(env, request);
    }

    // === EMS Enterprise Routes ===

    // POST /api/enterprises
    if (request.method === 'POST' && segments[0] === 'enterprises' && !segments[1]) {
      return createEnterprise(env, request);
    }

    // GET /api/enterprises
    if (request.method === 'GET' && segments[0] === 'enterprises' && !segments[1]) {
      return listEnterprises(env, request);
    }

    // GET /api/enterprises/:id/members
    if (request.method === 'GET' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'members' && !segments[3]) {
      return listEnterpriseMembers(env, request, segments[1]);
    }

    // POST /api/enterprises/:id/members
    if (request.method === 'POST' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'members' && !segments[3]) {
      return addEnterpriseMember(env, request, segments[1]);
    }

    // GET /api/enterprises/:id/members/:memberId
    if (request.method === 'GET' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'members' && segments[3]) {
      return getEnterpriseMember(env, request, segments[1], segments[3]);
    }

    // PATCH /api/enterprises/:id/members/:memberId
    if (request.method === 'PATCH' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'members' && segments[3]) {
      return updateEnterpriseMember(env, request, segments[1], segments[3]);
    }

    // DELETE /api/enterprises/:id/members/:memberId
    if (request.method === 'DELETE' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'members' && segments[3]) {
      return removeEnterpriseMember(env, request, segments[1], segments[3]);
    }

    // GET /api/enterprises/:id
    if (request.method === 'GET' && segments[0] === 'enterprises' && segments[1] && !segments[2]) {
      return getEnterprise(env, request, segments[1]);
    }

    // PUT /api/enterprises/:id
    if (request.method === 'PUT' && segments[0] === 'enterprises' && segments[1] && !segments[2]) {
      return updateEnterprise(env, request, segments[1]);
    }

    // DELETE /api/enterprises/:id
    if (request.method === 'DELETE' && segments[0] === 'enterprises' && segments[1] && !segments[2]) {
      return deleteEnterprise(env, request, segments[1]);
    }

    // === EMS Record Routes ===

    // POST /api/enterprises/:id/records
    if (request.method === 'POST' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'records' && !segments[3]) {
      return createRecord(env, request, segments[1]);
    }

    // GET /api/enterprises/:id/records
    if (request.method === 'GET' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'records' && !segments[3]) {
      return listRecords(env, request, segments[1]);
    }

    // GET /api/enterprises/:id/records/:recordId
    if (request.method === 'GET' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'records' && segments[3]) {
      return getRecord(env, request, segments[1], segments[3]);
    }

    // PUT /api/enterprises/:id/records/:recordId
    if (request.method === 'PUT' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'records' && segments[3]) {
      return updateRecord(env, request, segments[1], segments[3]);
    }

    // DELETE /api/enterprises/:id/records/:recordId
    if (request.method === 'DELETE' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'records' && segments[3]) {
      return deleteRecord(env, request, segments[1], segments[3]);
    }

    // PATCH /api/enterprises/:id/records/:recordId/status
    if (request.method === 'PATCH' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'records' && segments[3] && segments[4] === 'status') {
      return updateRecordStatus(env, request, segments[1], segments[3]);
    }

    // POST /api/enterprises/:id/records/:recordId/review
    if (request.method === 'POST' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'records' && segments[3] && segments[4] === 'review') {
      return reviewRecord(env, request, segments[1], segments[3]);
    }

    // GET /api/records/expiring
    if (request.method === 'GET' && segments[0] === 'records' && segments[1] === 'expiring') {
      return getExpiringRecords(env, request);
    }

    // === EMS Audit Routes ===

    // GET /api/enterprises/:id/audit-logs
    if (request.method === 'GET' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'audit-logs' && !segments[3]) {
      return listAuditLogs(env, request, segments[1]);
    }

    // GET /api/enterprises/:id/audit-logs/export
    if (request.method === 'GET' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'audit-logs' && segments[3] === 'export') {
      return exportAuditLogs(env, request, segments[1]);
    }

    // GET /api/audit-logs
    if (request.method === 'GET' && segments[0] === 'audit-logs' && !segments[1]) {
      return listMyAuditLogs(env, request);
    }

    // GET /api/audit-logs/:id
    if (request.method === 'GET' && segments[0] === 'audit-logs' && segments[1]) {
      return getAuditLog(env, request, segments[1]);
    }

    // GET /api/enterprises/:id/audit-logs/stats
    if (request.method === 'GET' && segments[0] === 'enterprises' && segments[1] && segments[2] === 'audit-logs' && segments[3] === 'stats') {
      return getAuditStats(env, request, segments[1]);
    }

    // === EMS User Routes ===

    // GET /api/users/profile
    if (request.method === 'GET' && segments[0] === 'users' && segments[1] === 'profile') {
      return getProfile(env, request);
    }

    // PUT /api/users/profile
    if (request.method === 'PUT' && segments[0] === 'users' && segments[1] === 'profile') {
      return updateProfile(env, request);
    }

    // PATCH /api/users/profile/avatar
    if (request.method === 'PATCH' && segments[0] === 'users' && segments[1] === 'profile' && segments[2] === 'avatar') {
      return updateAvatar(env, request);
    }

    // GET /api/users/search
    if (request.method === 'GET' && segments[0] === 'users' && segments[1] === 'search') {
      return searchUsers(env, request);
    }

    // GET /api/users/sessions
    if (request.method === 'GET' && segments[0] === 'users' && segments[1] === 'sessions' && !segments[2]) {
      return listSessions(env, request);
    }

    // GET /api/users/:id
    if (request.method === 'GET' && segments[0] === 'users' && segments[1] && !segments[2]) {
      return getUserById(env, request, segments[1]);
    }

    // DELETE /api/users/sessions/:sessionId
    if (request.method === 'DELETE' && segments[0] === 'users' && segments[1] === 'sessions' && segments[2]) {
      return revokeSession(env, request, segments[2]);
    }

    // DELETE /api/users/sessions
    if (request.method === 'DELETE' && segments[0] === 'users' && segments[1] === 'sessions' && !segments[2]) {
      return revokeAllSessions(env, request);
    }

    // PATCH /api/users/status
    if (request.method === 'PATCH' && segments[0] === 'users' && segments[1] === 'status') {
      return updateUserStatus(env, request);
    }

    return new Response(JSON.stringify(jsonError(ErrorCodes.NOT_FOUND, 'Endpoint not found')), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Unhandled error:', err);
    return new Response(JSON.stringify(jsonError(ErrorCodes.INTERNAL_ERROR, 'Internal server error')), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(env, request);
  },
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    const { handleScheduledPublishing } = await import('./admin/content');
    const { sendWeeklyNewsletter } = await import('./email');

    // Run scheduled publishing tasks
    await handleScheduledPublishing(env);

    // Send weekly newsletter (cron configured in wrangler.toml as "0 9 * * 4" - Thursday 9am)
    const cronRequest = new Request('https://findora.turingcorp.net/api/admin/email/send-weekly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    await sendWeeklyNewsletter(env, cronRequest);
  },
};
