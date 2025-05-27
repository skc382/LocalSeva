const express = require('express');
const admin = require('firebase-admin');
const Joi = require('joi');
const { geohashQueryBounds, distanceBetween } = require('geofire-common');

const router = express.Router();

// Validation schemas
const searchVendorsSchema = Joi.object({
  service_type: Joi.string().required().valid(
    'plumbing', 'electrical', 'carpentry', 'painting', 'ac_repair',
    'haircut', 'facial', 'massage', 'manicure', 'makeup'
  ),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  radius: Joi.number().min(0.5).max(10).default(3),
  limit: Joi.number().min(1).max(20).default(5),
  sort_by: Joi.string().valid('rating', 'distance', 'price').default('rating')
});

/**
 * POST /api/vendors/search
 * Search vendors based on service type and location
 */
router.post('/search', async (req, res, next) => {
  try {
    // Validate request body
    const { error, value } = searchVendorsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: {
          message: error.details[0].message,
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        }
      });
    }

    const { service_type, latitude, longitude, radius, limit, sort_by } = value;
    const userLocation = [latitude, longitude];

    console.log(`Searching vendors: ${service_type} near ${latitude}, ${longitude} within ${radius}km`);

    // Generate geohash query bounds
    const bounds = geohashQueryBounds(userLocation, radius * 1000);
    const promises = [];

    // Query Firestore for vendors within geohash bounds
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

    // Collect vendor candidates
    for (const snapshot of snapshots) {
      for (const doc of snapshot.docs) {
        const vendorData = doc.data();
        vendorCandidates.push({
          id: doc.id,
          ...vendorData
        });
      }
    }

    // Remove duplicates
    const uniqueVendors = vendorCandidates.filter((vendor, index, self) =>
      index === self.findIndex(v => v.id === vendor.id)
    );

    // Calculate distances and filter by radius
    const vendorsWithDistance = [];
    
    for (const vendor of uniqueVendors) {
      if (!vendor.location?.latitude || !vendor.location?.longitude) {
        continue;
      }

      const vendorLocation = [vendor.location.latitude, vendor.location.longitude];
      const distance = distanceBetween(userLocation, vendorLocation) / 1000;

      if (distance <= radius) {
        vendorsWithDistance.push({
          vendor_id: vendor.id,
          name: vendor.name,
          service_type: vendor.service_type,
          price: vendor.price || 0,
          ratings: vendor.ratings || 0,
          rating_count: vendor.rating_count || 0,
          distance: Math.round(distance * 100) / 100,
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

    // Sort vendors based on sort_by parameter
    const sortedVendors = vendorsWithDistance.sort((a, b) => {
      switch (sort_by) {
        case 'rating':
          if (b.ratings !== a.ratings) return b.ratings - a.ratings;
          if (a.distance !== b.distance) return a.distance - b.distance;
          return a.price - b.price;
        
        case 'distance':
          if (a.distance !== b.distance) return a.distance - b.distance;
          if (b.ratings !== a.ratings) return b.ratings - a.ratings;
          return a.price - b.price;
        
        case 'price':
          if (a.price !== b.price) return a.price - b.price;
          if (b.ratings !== a.ratings) return b.ratings - a.ratings;
          return a.distance - b.distance;
        
        default:
          return b.ratings - a.ratings;
      }
    });

    // Return limited results
    const results = sortedVendors.slice(0, limit);

    res.json({
      success: true,
      vendors: results,
      total_found: vendorsWithDistance.length,
      returned_count: results.length,
      search_params: {
        service_type,
        location: { latitude, longitude },
        radius,
        sort_by
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/vendors/:vendor_id
 * Get detailed information about a specific vendor
 */
router.get('/:vendor_id', async (req, res, next) => {
  try {
    const { vendor_id } = req.params;

    if (!vendor_id) {
      return res.status(400).json({
        error: {
          message: 'vendor_id is required',
          code: 'VALIDATION_ERROR',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Get vendor details
    const vendorDoc = await admin.firestore()
      .collection('vendors')
      .doc(vendor_id)
      .get();

    if (!vendorDoc.exists) {
      return res.status(404).json({
        error: {
          message: 'Vendor not found',
          code: 'VENDOR_NOT_FOUND',
          timestamp: new Date().toISOString()
        }
      });
    }

    const vendorData = vendorDoc.data();

    const response = {
      vendor_id: vendor_id,
      name: vendorData.name,
      service_type: vendorData.service_type,
      price: vendorData.price || 0,
      ratings: vendorData.ratings || 0,
      rating_count: vendorData.rating_count || 0,
      location: vendorData.location,
      phone_number: vendorData.phone_number,
      description: vendorData.description || '',
      profile_image: vendorData.profile_image || '',
      verified: vendorData.verified || false,
      experience_years: vendorData.experience_years || 0,
      specializations: vendorData.specializations || [],
      is_active: vendorData.is_active || false
    };

    res.json({
      success: true,
      vendor: response,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    next(error);
  }
});

module.exports = router; 