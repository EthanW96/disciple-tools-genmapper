<?php
if ( !defined( 'ABSPATH' ) ) {
    exit;
} // Exit if accessed directly.

/**
 * Each group's current state for the health watch: its practices, member count, coaches,
 * coaching groups and when anything last changed on it.
 */
class DT_Genmapper_Timeline_State_Queries
{
    /**
     * @return array|WP_Error [ 'groups' => id => state, 'coaching_groups' => list ]
     */
    public function current() {
        global $wpdb;
        $meta = $wpdb->get_results( "
            SELECT m.post_id, m.meta_key, m.meta_value
            FROM $wpdb->postmeta as m
            INNER JOIN $wpdb->posts as p ON p.ID = m.post_id AND p.post_type = 'groups'
            WHERE m.meta_key IN ( 'health_metrics', 'member_count' )
        ", ARRAY_A );
        if ( $wpdb->last_error ) {
            return $this->query_error( __METHOD__, $wpdb->last_error );
        }
        $coaches = $wpdb->get_results( "
            SELECT c.p2p_from as group_id, c.p2p_to as contact_id, contact.post_title as name
            FROM $wpdb->p2p as c
            INNER JOIN $wpdb->posts as contact ON contact.ID = c.p2p_to
            WHERE c.p2p_type = 'groups_to_coaches'
        ", ARRAY_A );
        if ( $wpdb->last_error ) {
            return $this->query_error( __METHOD__, $wpdb->last_error );
        }
        $last_activity = $this->last_activity();
        if ( is_wp_error( $last_activity ) ) {
            return $last_activity;
        }

        $state = [];
        foreach ( $meta as $row ) {
            $id = (int) $row['post_id'];
            if ( $row['meta_key'] === 'health_metrics' ) {
                $state[ $id ]['health'][] = $row['meta_value'];
            } else {
                $state[ $id ]['member_count'] = is_numeric( $row['meta_value'] ) ? (int) $row['meta_value'] : null;
            }
        }
        foreach ( $coaches as $row ) {
            $state[ (int) $row['group_id'] ]['coaches'][] = [ 'id' => (int) $row['contact_id'], 'name' => $row['name'] ];
        }
        foreach ( $last_activity as $id => $time ) {
            $state[ $id ]['last_activity'] = $time;
        }

        $coaching = $this->coaching();
        if ( is_wp_error( $coaching ) ) {
            return $coaching;
        }
        foreach ( $coaching['coverage'] as $id => $coaching_ids ) {
            $state[ $id ]['coaching'] = $coaching_ids;
        }
        return [ 'groups' => $state, 'coaching_groups' => $coaching['groups'] ];
    }

    /**
     * When anything was last recorded on each group: its latest activity-log entry or comment.
     *
     * @return array|WP_Error group id => Unix timestamp
     */
    private function last_activity() {
        global $wpdb;
        $logged = $wpdb->get_results( "
            SELECT object_id as id, MAX(hist_time) as time
            FROM $wpdb->dt_activity_log
            WHERE object_type = 'groups'
            GROUP BY object_id
        ", ARRAY_A );
        if ( $wpdb->last_error ) {
            return $this->query_error( __METHOD__, $wpdb->last_error );
        }
        $comments = $wpdb->get_results( "
            SELECT c.comment_post_ID as id, MAX(c.comment_date_gmt) as time
            FROM $wpdb->comments as c
            INNER JOIN $wpdb->posts as p ON p.ID = c.comment_post_ID AND p.post_type = 'groups'
            GROUP BY c.comment_post_ID
        ", ARRAY_A );
        if ( $wpdb->last_error ) {
            return $this->query_error( __METHOD__, $wpdb->last_error );
        }
        $latest = [];
        foreach ( $logged as $row ) {
            $latest[ (int) $row['id'] ] = (int) $row['time'];
        }
        foreach ( $comments as $row ) {
            $time = strtotime( $row['time'] . ' UTC' );
            if ( $time ) {
                $latest[ (int) $row['id'] ] = max( $latest[ (int) $row['id'] ] ?? 0, $time );
            }
        }
        return $latest;
    }

    /**
     * Coaching groups (when the setting is on) and which ones cover each group.
     *
     * @return array|WP_Error [ 'groups' => list of { id, name, members }, 'coverage' => group id => [ coaching ids ] ]
     */
    private function coaching() {
        $type = DT_Genmapper_Metrics::coaching_group_type();
        if ( $type === '' ) {
            return [ 'groups' => [], 'coverage' => [] ];
        }
        $result = dt_genmapper_plugin_queries()->coaching_coverage( $type );
        if ( is_wp_error( $result ) ) {
            return $result;
        }
        $groups = array_values( array_map( function ( $group ) {
            return [ 'id' => $group['id'], 'name' => $group['name'], 'members' => $group['members'] ];
        }, $result['coaching_groups'] ) );
        return [ 'groups' => $groups, 'coverage' => $result['coverage'] ];
    }

    private function query_error( string $method, string $error ) {
        error_log( "Genmapper $method query failed: $error" ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
        return new WP_Error( $method, __( 'Could not load the group timelines.', 'disciple-tools-genmapper' ), [ 'status' => 500 ] );
    }
}
