import math
import random
from models.schemas import RoutePoint


def generate_route(
    resource_lat: float, resource_lng: float,
    incident_lat: float, incident_lng: float,
    num_waypoints: int = 6,
) -> tuple[list[RoutePoint], int]:
    """
    Generate a realistic-looking route between resource and incident.
    In production this would call OSRM or Google Directions.
    For MVP: interpolates with slight random offsets to simulate real roads.
    Returns (route_points, eta_seconds).
    """
    # Haversine distance
    R = 6_371_000
    lat1, lat2 = math.radians(resource_lat), math.radians(incident_lat)
    dlat = math.radians(incident_lat - resource_lat)
    dlng = math.radians(incident_lng - resource_lng)
    a = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlng/2)**2
    dist_m = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))

    # Walking speed ~1.4 m/s, vehicle ~8 m/s in crowd
    speed = 5.0  # m/s average for emergency vehicle in crowded event
    eta_seconds = max(30, int(dist_m / speed))

    route = [RoutePoint(lat=resource_lat, lng=resource_lng)]

    for i in range(1, num_waypoints):
        t = i / num_waypoints
        # Linear interpolation with small random jitter
        jitter_lat = (random.random() - 0.5) * 0.0008
        jitter_lng = (random.random() - 0.5) * 0.0008
        lat = resource_lat + (incident_lat - resource_lat) * t + jitter_lat
        lng = resource_lng + (incident_lng - resource_lng) * t + jitter_lng
        route.append(RoutePoint(lat=round(lat, 7), lng=round(lng, 7)))

    route.append(RoutePoint(lat=incident_lat, lng=incident_lng))
    return route, eta_seconds