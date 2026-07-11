<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ExampleTest extends TestCase
{
    /**
     * A basic test example.
     *
     * @return void
     */
    public function test_the_application_returns_a_successful_response()
    {
        $response = $this->get('/');

        $response->assertRedirect(route('client'));
    }

    public function test_firebase_messaging_worker_returns_installable_javascript_without_config()
    {
        config(['services.firebase.public' => null]);

        $response = $this->get('/firebase-messaging-sw.js');

        $response
            ->assertOk()
            ->assertHeader('Content-Type', 'application/javascript; charset=UTF-8')
            ->assertSee('const firebaseConfig = {};', false)
            ->assertSee('self.addEventListener("notificationclick"', false);
    }
}
