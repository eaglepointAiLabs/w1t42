<template>
  <section class="card page">
    <div class="page-header">
      <div>
        <h2>Create Review</h2>
        <p class="meta">Publish feedback for a completed order and optionally attach up to 5 images.</p>
      </div>
      <router-link class="nav-link" to="/reviews">Back to Reviews</router-link>
    </div>

    <p v-if="loading" class="meta">Loading completed orders...</p>
    <p v-else-if="error" class="error">{{ error }}</p>

    <section v-else-if="!completedOrders.length" class="empty-state">
      <h3>No completed orders available</h3>
      <p class="meta">Complete an order first, then return here to publish a review.</p>
      <router-link class="nav-link" to="/orders">Open Orders</router-link>
    </section>

    <form v-else class="grid-2" @submit.prevent="submitReview">
      <label>
        Completed Order
        <select v-model.number="form.orderId" required>
          <option disabled value="">Select order</option>
          <option v-for="order in completedOrders" :key="order.id" :value="order.id">#{{ order.id }} · {{ order.course_service_title }}</option>
        </select>
      </label>

      <label>
        Rating
        <input v-model.number="form.rating" type="number" min="1" max="5" required />
      </label>

      <label class="grid-span-2">
        Review Text
        <textarea v-model="form.reviewText" maxlength="5000" required />
      </label>

      <section v-if="activeDimensions.length" class="grid-span-2 dimension-grid">
        <p class="meta"><strong>Dimension Scores (1-5)</strong></p>
        <div v-for="dimension in activeDimensions" :key="dimension.id" class="dimension-item">
          <label>
            {{ dimension.label }}
            <input
              :data-testid="`dimension-score-${dimension.id}`"
              v-model.number="dimensionScoresById[dimension.id]"
              type="number"
              min="1"
              max="5"
              required
            />
          </label>
        </div>
      </section>

      <label class="toggle-row">
        <input v-model="form.anonymousDisplay" type="checkbox" />
        Anonymous display
      </label>

      <label class="grid-span-2">
        Review Images (PNG/JPEG, up to 5 files)
        <input type="file" accept="image/png,image/jpeg" multiple @change="onImageSelect" />
      </label>

      <p v-if="imageError" class="error grid-span-2">{{ imageError }}</p>
      <ul v-if="selectedImages.length" class="coords-list grid-span-2">
        <li v-for="file in selectedImages" :key="file.name + ':' + file.size">{{ file.name }} ({{ Math.round(file.size / 1024) }} KB)</li>
      </ul>

      <div class="row gap wrap grid-span-2">
        <button :disabled="creating" type="submit">{{ creating ? "Publishing..." : "Publish Review" }}</button>
        <router-link class="nav-link" to="/reviews">Cancel</router-link>
      </div>
    </form>
  </section>
</template>

<script setup>
import { onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import { createReview, listOrders, listReviewDimensions, uploadReviewImage } from "../api";
import { useToast } from "../toast";
import { isLikelyOfflineError, recordOfflineIntent, buildOfflineRetryMessage } from "../offline/mutation-intents";

const router = useRouter();
const { pushToast } = useToast();
const loading = ref(false);
const creating = ref(false);
const error = ref("");
const completedOrders = ref([]);
const activeDimensions = ref([]);
const selectedImages = ref([]);
const imageError = ref("");
const dimensionScoresById = reactive({});

const form = reactive({
  orderId: "",
  rating: 5,
  reviewText: "",
  anonymousDisplay: false
});

async function load() {
  loading.value = true;
  error.value = "";
  try {
    const [ordersResponse, dimensionResponse] = await Promise.all([
      listOrders(),
      listReviewDimensions().catch(() => ({ data: [] }))
    ]);

    const orders = ordersResponse.data || [];
    completedOrders.value = orders.filter((order) => order.order_status === "completed");

    const dimensions = (dimensionResponse.data || []).filter(
      (dimension) => dimension.is_active === 1 || dimension.is_active === true || dimension.isActive === true
    );
    activeDimensions.value = dimensions;

    for (const dimension of dimensions) {
      if (dimensionScoresById[dimension.id] === undefined) {
        dimensionScoresById[dimension.id] = "";
      }
    }
  } catch (err) {
    error.value = err.message || "Failed to load completed orders";
  } finally {
    loading.value = false;
  }
}

function onImageSelect(event) {
  const files = Array.from(event.target.files || []);
  imageError.value = "";
  if (files.length > 5) {
    imageError.value = "Select up to 5 images.";
    selectedImages.value = files.slice(0, 5);
    return;
  }

  const invalid = files.find((file) => !["image/png", "image/jpeg"].includes(file.type) || file.size > 5 * 1024 * 1024);
  if (invalid) {
    imageError.value = "Only PNG/JPEG up to 5 MB are allowed.";
    selectedImages.value = [];
    return;
  }

  selectedImages.value = files;
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result || "");
      const idx = raw.indexOf(",");
      resolve(idx >= 0 ? raw.slice(idx + 1) : raw);
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

async function submitReview() {
  if (creating.value) {
    return;
  }

  const dimensionScores = [];
  for (const dimension of activeDimensions.value) {
    const score = Number(dimensionScoresById[dimension.id]);
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      pushToast("Provide a score from 1 to 5 for each review dimension", "error");
      return;
    }
    dimensionScores.push({
      dimensionConfigId: Number(dimension.id),
      score
    });
  }

  creating.value = true;
  try {
    const response = await createReview({
      orderId: Number(form.orderId),
      rating: Number(form.rating),
      reviewText: form.reviewText,
      anonymousDisplay: form.anonymousDisplay,
      dimensionScores
    });

    const reviewId = response.data?.id;
    if (reviewId && selectedImages.value.length) {
      for (const file of selectedImages.value) {
        const base64Data = await toBase64(file);
        await uploadReviewImage(reviewId, {
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
          base64Data
        });
      }
    }

    pushToast("Review published", "success");
    router.push("/reviews");
  } catch (err) {
    if (isLikelyOfflineError(err)) {
      recordOfflineIntent("review_create", {
        orderId: Number(form.orderId || 0),
        hasImages: Boolean(selectedImages.value.length)
      });
      pushToast(buildOfflineRetryMessage("Review publish"), "error");
    } else {
      pushToast(err.message || "Failed to create review", "error");
    }
  } finally {
    creating.value = false;
  }
}

onMounted(load);
</script>
