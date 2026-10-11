<?php
if ( !defined( 'ABSPATH' ) ) {
    exit;
} // Exit if accessed directly.

/**
 * Group histories for the timeline charts: real-world dates where D.T has them
 * (Start Date, Church Start Date, End Date, members' Baptism Dates) and the
 * activity log (when a change was entered in D.T.) for everything else.
 */
class DT_Genmapper_Timeline_Queries
{
    const LOGGED_FIELDS = [ 'group_type', 'group_status', 'health_metrics' ];
    const DELETED_VALUE = 'value_deleted';

    /**
     * @param int $group_id one group, or 0 for every group on the chart
     * @return array|WP_Error [ 'groups' => list of group histories ]
     */
    public function timeline( int $group_id = 0 ) {
        $tree = dt_genmapper_plugin_queries()->tree( 'multiplying_groups_only', [
            'include_unmultiplied' => true,
            'exclude_group_type' => DT_Genmapper_Metrics::coaching_group_type(),
        ] );
        if ( is_wp_error( $tree ) ) {
            return $tree;
        }
        $generations = dt_genmapper_plugin_queries()->generations( $tree );

        $dates = $this->dates();
        $activity = $this->activity( $group_id );
        $baptisms = $this->baptisms( $group_id );
        foreach ( [ $dates, $activity, $baptisms ] as $result ) {
            if ( is_wp_error( $result ) ) {
                return $result;
            }
        }

        $children = [];
        foreach ( $tree as $row ) {
            $children[ (int) $row['parent_id'] ][] = (int) $row['id'];
        }

        $health_labels = $this->health_labels();
        $groups = [];
        foreach ( $tree as $row ) {
            $id = (int) $row['id'];
            if ( $group_id && $id !== $group_id ) {
                continue;
            }
            $groups[] = $this->group_history( $row, $generations[ $row['id'] ] ?? 1, $dates, $activity[ $id ] ?? [], $baptisms[ $id ] ?? [], $children[ $id ] ?? [], $tree, $health_labels );
        }
        return [ 'groups' => $groups ];
    }

    private function group_history( array $row, int $generation, array $dates, array $logged, array $baptisms, array $child_ids, array $tree, array $health_labels ): array {
        $id = (int) $row['id'];
        $own = $dates[ $id ] ?? [];
        $events = array_merge(
            $this->logged_events( $logged, $health_labels ),
            $this->baptism_events( $baptisms ),
            $this->multiplication_events( $child_ids, $dates, $tree )
        );
        usort( $events, function ( $a, $b ) {
            return $a['time'] <=> $b['time'];
        } );
        $first_type = null;
        foreach ( $logged as $entry ) {
            if ( $entry['meta_key'] === 'group_type' ) {
                $first_type = $entry['meta_value'];
                break;
            }
        }
        return [
            'id' => $id,
            'name' => $row['name'],
            'parent_id' => (int) $row['parent_id'],
            'generation' => $generation,
            'type' => $row['group_type'],
            'status' => $row['group_status'],
            'first_type' => $first_type,
            'created' => $own['created'] ?? null,
            'started' => $own['started'] ?? null,
            'ecclesia' => $own['ecclesia'] ?? null,
            'ended' => $own['ended'] ?? null,
            'events' => $events,
        ];
    }

    private function logged_events( array $logged, array $health_labels ): array {
        $events = [];
        $health_seen = [];
        foreach ( $logged as $entry ) {
            $time = (int) $entry['hist_time'];
            $value = (string) $entry['meta_value'];
            if ( $entry['meta_key'] === 'group_type' || $entry['meta_key'] === 'group_status' ) {
                $kind = $entry['meta_key'] === 'group_type' ? 'type' : 'status';
                $events[] = [ 'kind' => $kind, 'time' => $time, 'value' => $value, 'source' => 'log' ];
            } elseif ( $entry['meta_key'] === 'health_metrics' && $value !== self::DELETED_VALUE && !isset( $health_seen[ $value ] ) ) {
                $health_seen[ $value ] = true; // first time each practice was marked
                $events[] = [ 'kind' => 'health', 'time' => $time, 'value' => $value, 'label' => $health_labels[ $value ] ?? $value, 'source' => 'log' ];
            } elseif ( $entry['meta_key'] === 'groups_to_coaches' ) {
                $events[] = [ 'kind' => 'coach', 'time' => $time, 'label' => (string) $entry['other_name'], 'source' => 'log' ];
            }
        }
        return $events;
    }

    // One event per day with the number of members baptized that day
    private function baptism_events( array $baptism_times ): array {
        $per_day = [];
        foreach ( $baptism_times as $time ) {
            $day = (int) ( floor( $time / DAY_IN_SECONDS ) * DAY_IN_SECONDS );
            $per_day[ $day ] = ( $per_day[ $day ] ?? 0 ) + 1;
        }
        $events = [];
        foreach ( $per_day as $day => $count ) {
            $events[] = [ 'kind' => 'baptism', 'time' => $day, 'count' => $count, 'source' => 'date' ];
        }
        return $events;
    }

    // A child group starting is the moment its parent multiplied
    private function multiplication_events( array $child_ids, array $dates, array $tree ): array {
        $events = [];
        foreach ( $child_ids as $child_id ) {
            $child = $dates[ $child_id ] ?? [];
            $time = $child['started'] ?? $child['created'] ?? null;
            if ( $time === null ) {
                continue;
            }
            $events[] = [
                'kind' => 'multiplied',
                'time' => $time,
                'child_id' => $child_id,
                'label' => $tree[ $child_id ]['name'] ?? '',
                'source' => isset( $child['started'] ) ? 'date' : 'log',
            ];
        }
        return $events;
    }

    /**
     * Created (entered in D.T.), Start Date, Church Start Date and End Date for every group
     *
     * @return array|WP_Error group id => [ created, started, ecclesia, ended ] as Unix timestamps
     */
    private function dates() {
        global $wpdb;
        $rows = $wpdb->get_results( "
            SELECT p.ID as id, p.post_date_gmt as created,
              s.meta_value as started, c.meta_value as ecclesia, e.meta_value as ended
            FROM $wpdb->posts as p
            LEFT JOIN $wpdb->postmeta as s ON s.post_id = p.ID AND s.meta_key = 'start_date'
            LEFT JOIN $wpdb->postmeta as c ON c.post_id = p.ID AND c.meta_key = 'church_start_date'
            LEFT JOIN $wpdb->postmeta as e ON e.post_id = p.ID AND e.meta_key = 'end_date'
            WHERE p.post_type = 'groups' AND p.post_status = 'publish'
        ", ARRAY_A );
        if ( $wpdb->last_error ) {
            return $this->query_error( __METHOD__, $wpdb->last_error );
        }
        $dates = [];
        foreach ( $rows as $row ) {
            $created = strtotime( $row['created'] . ' UTC' );
            $group_dates = [
                'created' => $created ? $created : null,
                'started' => $this->timestamp( $row['started'] ),
                'ecclesia' => $this->timestamp( $row['ecclesia'] ),
                'ended' => $this->timestamp( $row['ended'] ),
            ];
            $dates[ (int) $row['id'] ] = array_filter( $group_dates, 'is_int' );
        }
        return $dates;
    }

    /**
     * Type, status and health practice changes and coach connections, oldest first
     *
     * @return array|WP_Error group id => list of log rows
     */
    private function activity( int $group_id ) {
        global $wpdb;
        $rows = $wpdb->get_results( $wpdb->prepare( "
            SELECT a.object_id, a.action, a.meta_key, a.meta_value, a.hist_time, other.post_title as other_name
            FROM $wpdb->dt_activity_log as a
            LEFT JOIN $wpdb->posts as other
              ON a.meta_key = 'groups_to_coaches' AND other.ID = a.meta_value
            WHERE a.object_type = 'groups'
              AND ( %d = 0 OR a.object_id = %d )
              AND (
                ( a.action = 'field_update' AND a.meta_key IN ( 'group_type', 'group_status', 'health_metrics' ) )
                OR ( a.action = 'connected to' AND a.meta_key = 'groups_to_coaches' )
              )
            ORDER BY a.hist_time ASC, a.histid ASC
        ", $group_id, $group_id ), ARRAY_A );
        if ( $wpdb->last_error ) {
            return $this->query_error( __METHOD__, $wpdb->last_error );
        }
        $by_group = [];
        foreach ( $rows as $row ) {
            $by_group[ (int) $row['object_id'] ][] = $row;
        }
        return $by_group;
    }

    /**
     * Baptism Dates of each group's members
     *
     * @return array|WP_Error group id => list of Unix timestamps
     */
    private function baptisms( int $group_id ) {
        global $wpdb;
        $rows = $wpdb->get_results( $wpdb->prepare( "
            SELECT m.p2p_to as group_id, b.meta_value as baptism_date
            FROM $wpdb->p2p as m
            INNER JOIN $wpdb->postmeta as b
              ON b.post_id = m.p2p_from AND b.meta_key = 'baptism_date'
            WHERE m.p2p_type = 'contacts_to_groups'
              AND ( %d = 0 OR m.p2p_to = %d )
        ", $group_id, $group_id ), ARRAY_A );
        if ( $wpdb->last_error ) {
            return $this->query_error( __METHOD__, $wpdb->last_error );
        }
        $by_group = [];
        foreach ( $rows as $row ) {
            $time = $this->timestamp( $row['baptism_date'] );
            if ( $time !== null ) {
                $by_group[ (int) $row['group_id'] ][] = $time;
            }
        }
        return $by_group;
    }

    // D.T date fields hold Unix timestamps; anything else is treated as missing
    private function timestamp( $value ) {
        return is_numeric( $value ) && (int) $value > 0 ? (int) $value : null;
    }

    private function health_labels(): array {
        $fields = DT_Posts::get_post_field_settings( 'groups' );
        return array_map( function ( $option ) {
            return $option['label'] ?? '';
        }, $fields['health_metrics']['default'] ?? [] );
    }

    private function query_error( string $method, string $error ) {
        error_log( "Genmapper $method query failed: $error" ); // phpcs:ignore WordPress.PHP.DevelopmentFunctions.error_log_error_log
        return new WP_Error( $method, __( 'Could not load the group timelines.', 'disciple-tools-genmapper' ), [ 'status' => 500 ] );
    }
}
