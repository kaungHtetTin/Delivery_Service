export const statusLabels = {
  pending: "Pending",
  approved: "Approved",
  rider_assigned: "Rider Assign",
  rider_accepted: "Rider Accept",
  going_to_pickup: "Going to pickup",
  arrived_at_pickup: "At pickup",
  picked_up: "Pick up",
  going_to_delivery: "Going to delivery",
  arrived_at_delivery: "At destination",
  delivered: "Delivered",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const nextRiderActions = {
  rider_assigned: ["Confirm Accept", "rider_accepted"],
  rider_accepted: ["Pick up", "picked_up"],
  picked_up: ["Delivered", "delivered"],
  delivered: ["Complete order", "completed"],
};
