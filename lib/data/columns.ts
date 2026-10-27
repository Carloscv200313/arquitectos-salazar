// Financial list projections intentionally omit signature/signed_at.
export const WORK_MOVEMENT_COLUMNS = "id,work_id,folio,receipt,movement_date,concept,supplier,category,movement_type,amount,payment_method_id,observations,status,created_at,created_by";
export const PROJECT_PAYMENT_COLUMNS = "id,project_id,movement_type,concept,amount,payment_date,payment_method_id,internal_area,receipt_code,status,created_at,created_by";
export const WORK_ORDER_COLUMNS = "id,work_id,source,order_date,supplier,material,description,category,amount,quoted_at,payable_movement_id,is_requested,status,created_at,updated_at,created_by";
export const WORK_ORDER_PAYMENT_COLUMNS = "id,order_id,payment_date,description,amount,payment_method_id,work_movement_id,internal_transfer_id,created_at,created_by";
