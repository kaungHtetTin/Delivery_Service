export const statusLabels = {
  pending: "Pending approval",
  approved: "Approved",
  rider_assigned: "Rider assigned",
  rider_accepted: "Accepted",
  going_to_pickup: "Going to pickup",
  arrived_at_pickup: "At pickup",
  picked_up: "Picked up",
  going_to_delivery: "Going to delivery",
  arrived_at_delivery: "At destination",
  delivered: "Delivered",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const nextRiderActions = {
  rider_assigned: ["Accept assignment", "rider_accepted"],
  rider_accepted: ["Start pickup journey", "going_to_pickup"],
  going_to_pickup: ["Confirm pickup arrival", "arrived_at_pickup"],
  arrived_at_pickup: ["Confirm product pickup", "picked_up"],
  picked_up: ["Start delivery journey", "going_to_delivery"],
  going_to_delivery: ["Confirm destination arrival", "arrived_at_delivery"],
  arrived_at_delivery: ["Confirm delivered", "delivered"],
  delivered: ["Complete order", "completed"],
};
