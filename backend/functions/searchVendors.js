const admin = require('firebase-admin');
const functions = require('firebase-functions');
const axios = require('axios');
const { geohashQueryBounds, distanceBetween } = require('geofire-common');

/**
 * Search vendors based on service type and user location
 * Uses MapMyIndia API for distance calculation and Firestore for data storage
 */
const searchVendors = async (data, context) => {
  try {
    // Verify authentication
    if (!context.auth) {
      throw new functions.https.HttpsError(
        'unauthenticated',
        'User must be authenticated to search vendors'
      );
    }

    // Validate input data
    const { service_type, latitude, longitude, radius = 3 } = data;
    
    if (!service_type) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'service_type is required'
      );
    }

    if (!latitude || !longitude) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'User location (latitude, longitude) is required'
      );
    }

    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Invalid latitude or longitude values'
      );
    }

    console.log(`Searching vendors for service: ${service_type}, location: ${latitude}, ${longitude}, radius: ${radius}km`);

    const userLocation = [latitude, longitude];
    const radiusInKm = Math.min(radius, 10); // Max 10km radius for performance

    // Generate geohash query bounds for efficient location-based queries
    const bounds = geohashQueryBounds(userLocation, radiusInKm * 1000); // Convert to meters
    const promises = [];

    // Query Firestore for vendors within the geohash bounds
    for (const bound of bounds) {
      const query = admin.firestore()
        .collection('vendors')
        .where('service_type', '==', service_type.toLowerCase())
        .where('is_active', '==', true)
        .where('geohash', '>=', bound[0])
        .where('geohash', '<=', bound[1]);
      
      promises.push(query.get());
    }

    const snapshots = await Promise.all(promises);
    const vendorCandidates = [];

    // Collect all vendor candidates from geohash queries
    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        const vendorData = doc.data();
        vendorCandidates.push({
          id: doc.id,
          ...vendorData
        });
      }
    }

    // Remove duplicates (vendors might appear in multiple geohash bounds)
    const uniqueVendors = vendorCandidates.filter((vendor, index, self) =>
      index === self.findIndex(v => v.id === vendor.id)
    );

    console.log(`Found ${uniqueVendors.length} vendor candidates`);

    // Calculate exact distances and filter by radius
    const vendorsWithDistance = [];
    
    for (const vendor of uniqueVendors) {
      if (!vendor.location || !vendor.location.latitude || !vendor.location.longitude) {
        console.warn(`Vendor ${vendor.id} missing location data`);
        continue;
      }

      const vendorLocation = [vendor.location.latitude, vendor.location.longitude];
      const distance = distanceBetween(userLocation, vendorLocation) / 1000; // Convert to km

      if (distance <= radiusInKm) {
        // Calculate distance using MapMyIndia API for more accurate results
        let mapMyIndiaDistance = distance; // Fallback to calculated distance
        
        try {
          mapMyIndiaDistance = await getMapMyIndiaDistance(
            latitude, longitude,
            vendor.location.latitude, vendor.location.longitude
          );
        } catch (error) {
          console.warn(`MapMyIndia API error for vendor ${vendor.id}:`, error.message);
          // Continue with calculated distance
        }

        vendorsWithDistance.push({
          vendor_id: vendor.id,
          name: vendor.name,
          service_type: vendor.service_type,
          price: vendor.price || 0,
          ratings: vendor.ratings || 0,
          distance: Math.round(mapMyIndiaDistance * 100) / 100, // Round to 2 decimal places
          location: vendor.location,
          phone_number: vendor.phone_number,
          description: vendor.description || '',
          availability: vendor.availability || {},
          profile_image: vendor.profile_image || '',
          verified: vendor.verified || false,
          experience_years: vendor.experience_years || 0,
          specializations: vendor.specializations || []
        });
      }
    }

    console.log(`${vendorsWithDistance.length} vendors within ${radiusInKm}km radius`);

    if (vendorsWithDistance.length === 0) {
      return {
        success: true,
        vendors: [],
        message: `No ${service_type} vendors found within ${radiusInKm}km of your location`,
        search_params: {
          service_type,
          location: { latitude, longitude },
          radius: radiusInKm
        }
      };
    }

    // Sort vendors by multiple criteria:
    // 1. Ratings (descending)
    // 2. Distance (ascending)
    // 3. Price (ascending)
    const sortedVendors = vendorsWithDistance.sort((a, b) => {
      // Primary sort: Ratings (higher is better)
      if (b.ratings !== a.ratings) {
        return b.ratings - a.ratings;
      }
      
      // Secondary sort: Distance (closer is better)
      if (a.distance !== b.distance) {
        return a.distance - b.distance;
      }
      
      // Tertiary sort: Price (lower is better)
      return a.price - b.price;
    });

    // Return top 5 vendors
    const topVendors = sortedVendors.slice(0, 5);

    // Log search analytics
    await logSearchAnalytics(context.auth.uid, service_type, userLocation, topVendors.length);

    return {
      success: true,
      vendors: topVendors,
      total_found: vendorsWithDistance.length,
      returned_count: topVendors.length,
      search_params: {
        service_type,
        location: { latitude, longitude },
        radius: radiusInKm
      },
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.error('Vendor search error:', error);
    
    if (error instanceof functions.https.HttpsError) {
      throw error;
    }
    
    throw new functions.https.HttpsError(
      'internal',
      'Failed to search vendors. Please try again later.'
    );
  }
};

/**
 * Calculate distance using MapMyIndia API
 */
async function getMapMyIndiaDistance(lat1, lon1, lat2, lon2) {
  try {
    const MAPMYINDIA_API_KEY = functions.config().mapmyindia?.api_key;
    
    if (!MAPMYINDIA_API_KEY) {
      console.warn('MapMyIndia API key not configured, using calculated distance');
      return distanceBetween([lat1, lon1], [lat2, lon2]) / 1000;
    }

    const response = await axios.get('https://apis.mapmyindia.com/advancedmaps/v1/distance_matrix/driving', {
      params: {
        coordinates: `${lon1},${lat1};${lon2},${lat2}`,
        sources: '0',
        destinations: '1'
      },
      headers: {
        'Authorization': `Bearer ${MAPMYINDIA_API_KEY}`
      },
      timeout: 5000 // 5 second timeout
    });

    if (response.data && response.data.durations && response.data.durations[0] && response.data.durations[0][0]) {
      const distanceInMeters = response.data.distances[0][0];
      return distanceInMeters / 1000; // Convert to kilometers
    }

    // Fallback to calculated distance
    return distanceBetween([lat1, lon1], [lat2, lon2]) / 1000;

  } catch (error) {
    console.error('MapMyIndia API error:', error.message);
    // Fallback to calculated distance
    return distanceBetween([lat1, lon1], [lat2, lon2]) / 1000;
  }
}

/**
 * Log search analytics for insights
 */
async function logSearchAnalytics(userId, serviceType, location, resultsCount) {
  try {
    await admin.firestore().collection('search_analytics').add({
      user_id: userId,
      service_type: serviceType,
      location: {
        latitude: location[0],
        longitude: location[1]
      },
      results_count: resultsCount,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      date: new Date().toISOString().split('T')[0] // YYYY-MM-DD format
    });
  } catch (error) {
    console.error('Failed to log search analytics:', error);
    // Don't throw error for analytics failure
  }
}

module.exports = searchVendors; 